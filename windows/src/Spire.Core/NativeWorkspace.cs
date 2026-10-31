using System.Text.Json;
namespace Spire.Core;

// Separate directory and explicit schema: the delivered preview is never implicitly adopted.
public sealed class NativeWorkspaceStore(string directory)
{
 readonly WorkspaceStore store=new(directory);
 public Action? BeforeCommit {get;set;}
 sealed record Envelope(int NativeSchema,SyncWorkspace State);
 public async Task<SyncWorkspace> LoadAsync(CancellationToken cancellation=default)
 {
  var saved=await store.LoadAsync(cancellation);
  if(saved.ServerSnapshot is null)return SyncWorkspace.Empty;
  var payload=saved.ServerSnapshot.Value.Deserialize<Envelope>(SyncWorkspace.Json)??throw new InvalidDataException("Invalid native workspace.");
  if(payload.NativeSchema!=1||payload.State.Outbox is null||payload.State.Conflicts is null||payload.State.MetadataOutbox is null||payload.State.MetadataConflicts is null||payload.State.FolderOutbox is null||payload.State.FolderConflicts is null||payload.State.StyleOutbox is null||payload.State.PendingActivations is null||payload.State.ActivationLedger is null)throw new InvalidDataException("Unknown or corrupt native workspace; original retained.");
  foreach(var activation in payload.State.PendingActivations)
  {
   if(activation.ActionId==Guid.Empty||activation.Op==Guid.Empty||payload.State.PendingActivations.Count(p=>p.ActionId==activation.ActionId)>1)throw new InvalidDataException("Corrupt pending activation; state retained.");
  }
  if(payload.State.QuickActionOrder is not null)
  {
   if(payload.State.QuickActionOrder.Op==Guid.Empty||payload.State.QuickActionOrder.Ids.Any(id=>!Guid.TryParse(id,out var parsed)||parsed==Guid.Empty)||payload.State.QuickActionOrder.Expected.Any(id=>!Guid.TryParse(id,out var parsed)||parsed==Guid.Empty))throw new InvalidDataException("Corrupt quick action order; state retained.");
  }
  foreach(var style in payload.State.StyleOutbox){LocalFiles.ValidatePortablePath(style.Path);QuickActionRules.ValidateStyle(style.Path,style.Content);}
  _=payload.State.VisibleFiles();_=payload.State.Folders();
  var folderIds=new HashSet<Guid>();var folderPaths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var operation in payload.State.FolderOutbox.Concat(payload.State.FolderConflicts.Select(c=>c.Operation)))
  {LocalFiles.ValidatePortablePath(operation.Path);if(operation.Id==Guid.Empty||!folderIds.Add(operation.Id)||!folderPaths.Add(operation.Path))throw new InvalidDataException("Corrupt folder outbox; state retained.");}
  return payload.State;
 }
 public Task SaveAsync(SyncWorkspace state,CancellationToken cancellation=default)
 {
  BeforeCommit?.Invoke();
  return store.SaveAsync(new(1,JsonSerializer.SerializeToElement(new Envelope(1,state),SyncWorkspace.Json),[]),cancellation);
 }
}

public sealed partial class NativeWorkspace
{
 readonly NativeWorkspaceStore store;
 readonly SemaphoreSlim gate=new(1,1);
 public SyncWorkspace State {get;private set;}
 NativeWorkspace(NativeWorkspaceStore store,SyncWorkspace state){this.store=store;State=state;}
 public static async Task<NativeWorkspace> OpenAsync(NativeWorkspaceStore store)=>new(store,await store.LoadAsync());
 async Task Commit(SyncWorkspace next){await store.SaveAsync(next);State=next;}
 public async Task EditAsync(ServerFile file)
 {
  await gate.WaitAsync();try
  {
   LocalFiles.ValidatePath(file.Path);
   if(!file.Deleted&&State.FolderDeletionContains(file.Path))throw new InvalidOperationException("Resolve the pending folder deletion before saving files inside it.");
   if(State.VisibleFiles().Any(f=>f.Id!=file.Id&&!f.Deleted&&!file.Deleted&&(string.Equals(f.Path,file.Path,StringComparison.OrdinalIgnoreCase)||f.Path.StartsWith(file.Path+"/",StringComparison.OrdinalIgnoreCase)||file.Path.StartsWith(f.Path+"/",StringComparison.OrdinalIgnoreCase))))throw new ArgumentException("A file already occupies this path.");
   var old=State.VisibleFiles().FirstOrDefault(f=>f.Id==file.Id);
   if(old is not null&&old.Path!=file.Path)file=file with{Content=PortableCitations.Rebase(file.Content,file.Path)};
   if(old is not null&&old.Path==file.Path&&old.Content==file.Content&&old.Deleted==file.Deleted&&Enumerable.SequenceEqual(old.TemplateIds??[],file.TemplateIds??[]))return;
   if(State.Conflicts.Any(c=>c.GetProperty("mutation").GetProperty("id").GetGuid()==file.Id))throw new InvalidOperationException("Resolve this file's conflict before saving. The draft is preserved.");
   await Commit(State.Queue(file));
  }finally{gate.Release();}
 }
 public async Task EditLibraryAsync(string collection,JsonElement record)
 {await gate.WaitAsync();try{await Commit(State.QueueLibrary(collection,record));}finally{gate.Release();}}
 public async Task CreateLibraryAsync(string collection,JsonElement record)
 {await gate.WaitAsync();try{await Commit(State.QueueLibraryCreate(collection,record));}finally{gate.Release();}}
 public async Task DeleteLibraryAsync(string collection,string id)
 {await gate.WaitAsync();try{await Commit(State.QueueLibraryDelete(collection,id));}finally{gate.Release();}}
 public async Task ResolveLibraryAsync(Guid id,bool keepLocal)
 {await gate.WaitAsync();try{await Commit(State.ResolveLibrary(id,keepLocal));}finally{gate.Release();}}
 public async Task AttachAsync(ServerFile file,string path,byte[] bytes)
 {
  await gate.WaitAsync();try
  {
   LocalFiles.ValidatePortablePath(path);LocalFiles.ValidatePath(file.Path);
   if(State.FolderDeletionContains(path))throw new InvalidOperationException("Resolve the pending folder deletion before adding attachments inside it.");
   if(bytes.Length==0||bytes.Length>10_000_000||path.EndsWith(".md",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Attach a nonempty non-Markdown file of at most 10 MB.");
   var paths=State.VisibleFiles().Where(f=>!f.Deleted).Select(f=>f.Path).Concat(State.Assets.Keys);
   if(paths.Any(p=>string.Equals(p,path,StringComparison.OrdinalIgnoreCase)||p.StartsWith(path+"/",StringComparison.OrdinalIgnoreCase)||path.StartsWith(p+"/",StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("Attachment path is occupied.");
   if(State.VisibleFiles().Any(f=>f.Id!=file.Id&&!f.Deleted&&string.Equals(f.Path,file.Path,StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("File path is occupied.");
   if(State.Conflicts.Any(c=>c.GetProperty("mutation").GetProperty("id").GetGuid()==file.Id))throw new InvalidOperationException("Resolve the file conflict first.");
   var assets=new Dictionary<string,string>(State.Assets){[path]=Convert.ToBase64String(bytes)};
   await Commit(State.Queue(file) with{Assets=assets,PendingAssets=State.PendingAssets.Append(path).ToArray()});
  }finally{gate.Release();}
 }
 public async Task SyncAsync(ISyncTransport transport,CancellationToken cancellation=default)
 {
  await gate.WaitAsync(cancellation);try{await new SyncCoordinator(transport,Commit).RunAsync(State,cancellation);}finally{gate.Release();}
 }
 public async Task ResolveAsync(string id,bool keepLocal)
 {await gate.WaitAsync();try{await Commit(State.ResolveConflict(id,keepLocal));}finally{gate.Release();}}
 public async Task AdoptPreviewAsync(IEnumerable<LocalFile> files)
 {
  await gate.WaitAsync();try
  {
   var next=State;
   foreach(var f in files)
   {
    var existing=next.VisibleFiles().FirstOrDefault(n=>n.Id==f.Id);
    if(existing is not null){if(existing.Path==f.Path&&existing.Content==f.Content&&existing.Deleted==f.Deleted)continue;throw new InvalidOperationException("Preview identity already adopted and has changed; nothing was imported.");}
    if(next.VisibleFiles().Select(n=>n.Path).Concat(next.Assets.Keys).Any(p=>string.Equals(p,f.Path,StringComparison.OrdinalIgnoreCase)||p.StartsWith(f.Path+"/",StringComparison.OrdinalIgnoreCase)||f.Path.StartsWith(p+"/",StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("Preview path collision; nothing was imported.");
    next=next.Queue(new(f.Id,0,f.Path,f.Content,f.Deleted,"",JsonSerializer.SerializeToElement(Array.Empty<object>())));
   }
   await Commit(next);
  }finally{gate.Release();}
 }
}
