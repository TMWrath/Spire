using System.IO.Compression;
using System.Text.Json;
namespace Spire.Core;

public static class WorkspaceArchive
{
 const long MaxBytes=256L*1024*1024;
 sealed record Archive(int Schema,SyncWorkspace Workspace);
 public static async Task ExportAsync(string destination,SyncWorkspace state)
 {
  var full=Path.GetFullPath(destination);var temporary=full+"."+Guid.NewGuid().ToString("N")+".tmp";
  try
  {
   await using(var stream=new FileStream(temporary,FileMode.CreateNew,FileAccess.Write,FileShare.None))
   {
    using(var zip=new ZipArchive(stream,ZipArchiveMode.Create,true))
    {
     var entry=zip.CreateEntry("workspace.json",CompressionLevel.Optimal);
     await using var output=entry.Open();await JsonSerializer.SerializeAsync(output,new Archive(1,state),SyncWorkspace.Json);
    }
    await stream.FlushAsync();stream.Flush(true);
   }
   File.Move(temporary,full,true);
  }finally{if(File.Exists(temporary))File.Delete(temporary);}
 }
 public static async Task<SyncWorkspace> ReadAsync(string path)
 {
  using var zip=ZipFile.OpenRead(path);
  if(zip.Entries.Count!=1||zip.Entries[0].FullName!="workspace.json")throw new InvalidDataException("Not a Spire workspace backup.");
  var entry=zip.Entries[0];if(entry.Length<=0||entry.Length>MaxBytes)throw new InvalidDataException("Backup exceeds the supported size.");
  await using var stream=entry.Open();using var buffer=new MemoryStream();var bytes=new byte[65536];int count;
  while((count=await stream.ReadAsync(bytes))!=0){if(buffer.Length+count>MaxBytes)throw new InvalidDataException("Backup exceeds the supported size.");await buffer.WriteAsync(bytes.AsMemory(0,count));}
  buffer.Position=0;var archive=await JsonSerializer.DeserializeAsync<Archive>(buffer,SyncWorkspace.Json)??throw new InvalidDataException("Missing workspace.");
  if(archive.Schema!=1)throw new InvalidDataException("Unsupported backup version.");
  var state=archive.Workspace??throw new InvalidDataException("Missing workspace.");
  if(state.Outbox is null||state.Conflicts is null||state.Assets is null||state.PendingAssets is null||state.MetadataOutbox is null||state.MetadataConflicts is null||state.FolderOutbox is null||state.FolderConflicts is null||state.StyleOutbox is null||state.PendingActivations is null||state.ActivationLedger is null)throw new InvalidDataException("Incomplete workspace.");
  if(state.Snapshot is not null)_=state.Receive(state.Snapshot.Value); // Revalidates notes, folders and styles.
  var files=state.VisibleFiles();var active=files.Where(f=>!f.Deleted).ToArray();
  if(files.Select(f=>f.Id).Distinct().Count()!=files.Count)throw new InvalidDataException("Duplicate file identity.");
  foreach(var f in files){LocalFiles.ValidatePath(f.Path);if(f.Id==Guid.Empty||f.Content is null||f.Content.Length>1_000_000)throw new InvalidDataException("Invalid backup file.");}
  foreach(var f in active)if(active.Any(other=>other.Id!=f.Id&&(string.Equals(other.Path,f.Path,StringComparison.OrdinalIgnoreCase)||other.Path.StartsWith(f.Path+"/",StringComparison.OrdinalIgnoreCase))))throw new InvalidDataException("Colliding backup paths.");
  foreach(var asset in state.Assets){LocalFiles.ValidatePortablePath(asset.Key);var data=Convert.FromBase64String(asset.Value);if(data.Length==0||data.Length>10_000_000)throw new InvalidDataException("Invalid backup attachment.");}
  if(state.PendingAssets.Any(p=>!state.Assets.ContainsKey(p)))throw new InvalidDataException("Missing pending attachment.");
  foreach(var folder in state.Folders())LocalFiles.ValidatePortablePath(folder);
  // Folder operations must be uniquely identified and non-overlapping before any restore.
  var folderIds=new HashSet<Guid>();var folderPaths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var mutation in state.FolderOutbox.Concat(state.FolderConflicts.Select(c=>c.Operation)))
  {
   LocalFiles.ValidatePortablePath(mutation.Path);
   if(mutation.Id==Guid.Empty||!folderIds.Add(mutation.Id)||!folderPaths.Add(mutation.Path))throw new InvalidDataException("Corrupt backup folder operation.");
  }
  // Quick action order and activations are validated like the native store: valid identities only.
  if(state.QuickActionOrder is not null)
  {
   if(state.QuickActionOrder.Op==Guid.Empty||state.QuickActionOrder.Ids.Any(id=>!Guid.TryParse(id,out var parsed)||parsed==Guid.Empty)||state.QuickActionOrder.Expected.Any(id=>!Guid.TryParse(id,out var parsed)||parsed==Guid.Empty))throw new InvalidDataException("Corrupt backup quick action order.");
   if(state.QuickActionOrder.Ids.Distinct(StringComparer.Ordinal).Count()!=state.QuickActionOrder.Ids.Length)throw new InvalidDataException("Corrupt backup quick action order.");
  }
  foreach(var activation in state.PendingActivations)
   if(activation.ActionId==Guid.Empty||activation.Op==Guid.Empty||state.PendingActivations.Count(p=>p.ActionId==activation.ActionId)>1)throw new InvalidDataException("Corrupt backup activation.");
  foreach(var style in state.StyleOutbox)
  {
   LocalFiles.ValidatePortablePath(style.Path);
   QuickActionRules.ValidateStyle(style.Path,style.Content);
   if(state.StyleOutbox.Count(s=>string.Equals(s.Path,style.Path,StringComparison.OrdinalIgnoreCase))>1)throw new InvalidDataException("Corrupt backup stylesheet edit.");
  }
  foreach(var ledger in state.ActivationLedger)if(ledger.ActionId==Guid.Empty||ledger.Op==Guid.Empty||ledger.NoteId==Guid.Empty)throw new InvalidDataException("Corrupt backup activation ledger.");
  return state;
 }
}
public sealed partial class NativeWorkspace
{
 public async Task ExportBackupAsync(string path)
 {await gate.WaitAsync();try{await WorkspaceArchive.ExportAsync(path,State);}finally{gate.Release();}}
 public async Task RestoreBackupAsync(string path)
 {
  await gate.WaitAsync();try
  {
   var restored=await WorkspaceArchive.ReadAsync(path);
   if(State.Owner is not null&&restored.Owner!=State.Owner)throw new InvalidOperationException("Backup belongs to a different account. Current workspace retained.");
   await Commit(restored);
  }finally{gate.Release();}
 }
 public async Task ImportMarkdownAsync(IEnumerable<(string Path,string Content)> imported)
 {
  await gate.WaitAsync();try
  {
   var next=State;
   foreach(var entry in imported)
   {
    LocalFiles.ValidatePath(entry.Path);
    if(next.VisibleFiles().Any(f=>string.Equals(f.Path,entry.Path,StringComparison.OrdinalIgnoreCase)||f.Path.StartsWith(entry.Path+"/",StringComparison.OrdinalIgnoreCase)||entry.Path.StartsWith(f.Path+"/",StringComparison.OrdinalIgnoreCase))||next.Assets.Keys.Any(p=>string.Equals(p,entry.Path,StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("Import path is occupied. No files were imported.");
    next=next.Queue(new(Guid.NewGuid(),0,entry.Path,entry.Content,false,"",JsonSerializer.SerializeToElement(Array.Empty<object>())));
   }
   await Commit(next);
  }finally{gate.Release();}
 }
}
