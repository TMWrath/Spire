using System.Text.Json;
namespace Spire.Core;
public sealed record FolderMutation(Guid Id,string Path,bool Delete,bool Attempted=false);
public sealed record FolderConflict(FolderMutation Operation,string Reason);
public interface IFolderSyncTransport
{
 // False means server rejected the operation (409), not a success acknowledgement.
 Task<bool> MutateFolderAsync(FolderMutation mutation,CancellationToken cancellation);
}
public sealed partial record SyncWorkspace
{
 public IReadOnlyList<FolderMutation> FolderOutbox {get;init;}=[];
 public IReadOnlyList<FolderConflict> FolderConflicts {get;init;}=[];
 internal static IReadOnlyList<string> SnapshotFolders(JsonElement? snapshot)
 {
  if(snapshot is null||!snapshot.Value.TryGetProperty("folders",out var array))return [];
  if(array.ValueKind!=JsonValueKind.Array)throw new InvalidDataException("Invalid folder inventory.");
  var paths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var result=new List<string>();
  foreach(var item in array.EnumerateArray())
  {if(item.ValueKind!=JsonValueKind.String)throw new InvalidDataException("Invalid folder path.");var path=item.GetString()!;LocalFiles.ValidatePortablePath(path);if(!paths.Add(path))throw new InvalidDataException("Colliding folder paths.");result.Add(path);}
  return result;
 }
 public IReadOnlyList<string> Folders()
 {
  var result=SnapshotFolders(Snapshot).ToList();
  foreach(var m in FolderConflicts.Select(c=>c.Operation).Concat(FolderOutbox))
  {result.RemoveAll(p=>string.Equals(p,m.Path,StringComparison.OrdinalIgnoreCase));if(!m.Delete)result.Add(m.Path);}
  return result;
 }
 public bool FolderDeletionContains(string path)=>FolderOutbox.Concat(FolderConflicts.Select(c=>c.Operation)).Any(m=>m.Delete&&(string.Equals(m.Path,path,StringComparison.OrdinalIgnoreCase)||path.StartsWith(m.Path+"/",StringComparison.OrdinalIgnoreCase)));
 internal bool FolderHasContents(string path)
 {
  bool Inside(string p)=>p.StartsWith(path+"/",StringComparison.OrdinalIgnoreCase);
  var assets=Snapshot is not null&&Snapshot.Value.TryGetProperty("attachments",out var a)?a.EnumerateArray().Select(x=>x.GetProperty("path").GetString()!):[];
  var styles=Snapshot is not null&&Snapshot.Value.TryGetProperty("styles",out var s)?s.EnumerateObject().Select(x=>x.Name):[];
  return VisibleFiles().Any(f=>!f.Deleted&&Inside(f.Path))||Assets.Keys.Concat(assets).Concat(styles).Concat(Folders()).Any(Inside);
 }
 public SyncWorkspace QueueFolder(string path,bool delete)
 {
  LocalFiles.ValidatePortablePath(path);
  if(FolderConflicts.Any(c=>string.Equals(c.Operation.Path,path,StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("Resolve the folder conflict first.");
  var prior=FolderOutbox.SingleOrDefault(m=>string.Equals(m.Path,path,StringComparison.OrdinalIgnoreCase));
  var folders=Folders();bool exists=folders.Any(p=>string.Equals(p,path,StringComparison.OrdinalIgnoreCase));
  if(delete)
  {
   if(!exists)throw new ArgumentException("Folder not found.");
   if(FolderHasContents(path))throw new InvalidOperationException("Folder contains files, child folders, attachments or styles. Only empty-folder deletion is implemented safely.");
   if(prior is{Delete:false,Attempted:false})return this with{FolderOutbox=FolderOutbox.Where(m=>m.Id!=prior.Id).ToArray()};
  }
  else
  {
   if(exists)throw new ArgumentException("Folder already exists.");
   if(FolderDeletionContains(path))throw new InvalidOperationException("This folder or its parent is pending deletion.");
   var files=VisibleFiles().Where(f=>!f.Deleted).Select(f=>f.Path).Concat(Assets.Keys);
   if(files.Any(p=>string.Equals(p,path,StringComparison.OrdinalIgnoreCase)||path.StartsWith(p+"/",StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("A file occupies the folder path.");
  }
  return this with{FolderOutbox=FolderOutbox.Where(m=>m.Id!=prior?.Id).Append(new FolderMutation(Guid.NewGuid(),path,delete)).ToArray()};
 }
 public SyncWorkspace ResolveFolder(Guid id,bool retry)
 {
  var conflict=FolderConflicts.Single(c=>c.Operation.Id==id);var next=this with{FolderConflicts=FolderConflicts.Where(c=>c.Operation.Id!=id).ToArray()};
  if(!retry)return next;
  return next.QueueFolder(conflict.Operation.Path,conflict.Operation.Delete);
 }
}
public sealed class FolderSyncCoordinator(ISyncTransport transport,Func<SyncWorkspace,Task> persist)
{
 public async Task<SyncWorkspace> RunAsync(SyncWorkspace state,bool deletions,CancellationToken cancellation)
 {
  foreach(var original in state.FolderOutbox.Where(m=>m.Delete==deletions).ToArray())
  {
   if(transport is not IFolderSyncTransport folders)throw new InvalidOperationException("Transport cannot synchronize folders; local changes retained.");
   var m=original;var snapshot=await transport.SnapshotAsync(cancellation);state=state.Receive(snapshot);
   bool exists=SyncWorkspace.SnapshotFolders(snapshot).Any(p=>string.Equals(p,m.Path,StringComparison.OrdinalIgnoreCase));
   if(m.Delete&&!exists||!m.Delete&&exists)
   {state=state with{FolderOutbox=state.FolderOutbox.Where(p=>p.Id!=m.Id).ToArray()};await persist(state);continue;}
   if(m.Delete&&state.FolderHasContents(m.Path))
   {state=Conflict(state,m,"Folder is no longer empty. Local deletion retained for explicit resolution.");await persist(state);continue;}
   // Record dispatch before network I/O so restart can reconcile lost acknowledgements.
   m=m with{Attempted=true};state=state with{FolderOutbox=state.FolderOutbox.Select(p=>p.Id==m.Id?m:p).ToArray()};await persist(state);
   if(!await folders.MutateFolderAsync(m,cancellation))
   {
    state=state.Receive(await transport.SnapshotAsync(cancellation));state=Conflict(state,m,"Server rejected this folder operation. Inspect current contents before retrying.");await persist(state);continue;
   }
   // A full snapshot is required before clearing the overlay; if pull fails, retain the op.
   state=state.Receive(await transport.SnapshotAsync(cancellation)) with{FolderOutbox=state.FolderOutbox.Where(p=>p.Id!=m.Id).ToArray()};await persist(state);
  }
  return state;
 }
 static SyncWorkspace Conflict(SyncWorkspace state,FolderMutation m,string reason)=>state with{FolderOutbox=state.FolderOutbox.Where(p=>p.Id!=m.Id).ToArray(),FolderConflicts=state.FolderConflicts.Append(new(m,reason)).ToArray()};
}
