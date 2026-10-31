using System.Text.Json;
using System.Text.Json.Nodes;
using Spire.Core;
static class FolderTests
{
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 static async Task Reject(Func<Task> action){try{await action();}catch(ArgumentException){return;}catch(InvalidOperationException){return;}throw new Exception("Unsafe folder action accepted");}
 public static async Task Run()
 {
  var dir=Path.Combine(Path.GetTempPath(),"spire-folders-"+Guid.NewGuid());try
  {
   var store=new NativeWorkspaceStore(dir);var ws=await NativeWorkspace.OpenAsync(store);
   await ws.CreateFolderAsync("Writing/Empty");Check(ws.State.Folders().Contains("Writing/Empty"),"Offline folder missing");
   ws=await NativeWorkspace.OpenAsync(store);Check(ws.State.FolderOutbox.Count==1,"Folder outbox lost on restart");
   await Reject(()=>ws.CreateFolderAsync("writing/empty"));await Reject(()=>ws.CreateFolderAsync("Writing/CON"));
   await ws.DeleteEmptyFolderAsync("Writing/Empty");Check(ws.State.FolderOutbox.Count==0&&!ws.State.Folders().Contains("Writing/Empty"),"Never-sent folder cancellation queued destructive deletion");
   store.BeforeCommit=()=>throw new IOException("disk full");try{await ws.CreateFolderAsync("Safe");throw new Exception("Failure missing");}catch(IOException){}Check(ws.State.FolderOutbox.Count==0,"Failed folder commit changed memory");store.BeforeCommit=null;
   var remote=new Transport();await ws.CreateFolderAsync("Archive");remote.LoseReply=true;try{await ws.SyncAsync(remote);}catch(IOException){}Check(ws.State.FolderOutbox.Count==1&&remote.Creates==1,"Lost folder reply discarded outbox");
   ws=await NativeWorkspace.OpenAsync(store);await ws.SyncAsync(remote);Check(remote.Creates==1&&ws.State.FolderOutbox.Count==0&&ws.State.Snapshot!.Value.GetProperty("future").GetBoolean(),"Folder reconciliation duplicated POST or dropped unknown snapshot");
   await ws.DeleteEmptyFolderAsync("Archive");remote.LoseReply=true;try{await ws.SyncAsync(remote);}catch(IOException){}await ws.SyncAsync(remote);Check(remote.Deletes==1&&ws.State.FolderOutbox.Count==0,"Lost deletion reply repeated DELETE");
   await ws.CreateFolderAsync("Writing");await ws.SyncAsync(remote);
   var file=new ServerFile(Guid.NewGuid(),0,"Writing/a.md","draft",false,"",JsonSerializer.SerializeToElement(Array.Empty<object>()));await ws.EditAsync(file);await Reject(()=>ws.DeleteEmptyFolderAsync("Writing"));await ws.EditAsync(file with{Deleted=true});
   await ws.CreateFolderAsync("Writing/Child");await Reject(()=>ws.DeleteEmptyFolderAsync("Writing"));await ws.DeleteEmptyFolderAsync("Writing/Child");
   await ws.DeleteEmptyFolderAsync("Writing");await Reject(()=>ws.EditAsync(file with{Deleted=false}));
   await Reject(()=>ws.AttachAsync(file with{Path="Other/a.md",Deleted=false},"Writing/asset.bin",[1,2,3]));
   await Reject(()=>ws.AdoptPreviewAsync([new LocalFile(Guid.NewGuid(),"Writing/preview.md","preview",false)]));
   remote.Occupied=true;await ws.SyncAsync(remote);Check(ws.State.FolderConflicts.Count==1&&ws.State.FolderOutbox.Count==0,"Remote nonempty folder not retained as explicit conflict");
   await ws.ResolveFolderAsync(ws.State.FolderConflicts[0].Operation.Id,false);Check(ws.State.Folders().Contains("Writing")&&ws.State.FolderConflicts.Count==0,"Accept remote did not restore folder projection");
   Console.WriteLine("PASS: durable offline folders, Windows-safe/case paths, atomic failure, unsent-create cancellation, lost create/delete replies without duplicates, nonempty/nested guards, deletion edit guard and explicit remote conflict resolution");
  }finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}
 }
 sealed class Transport:ISyncTransport,IFolderSyncTransport
 {
  public HashSet<string> Folders=[];public int Creates,Deletes;public bool LoseReply,Occupied;
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(new{owner="folder-owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(new{seq=1,notes=Array.Empty<object>(),folders=Folders.ToArray(),future=true}));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement value,CancellationToken c){var m=value.Deserialize<FileMutation>(SyncWorkspace.Json)!;return Task.FromResult((false,JsonSerializer.SerializeToElement(new ServerFile(m.Id,m.Base+1,m.Path,m.Content,m.Deleted,"",JsonSerializer.SerializeToElement(Array.Empty<object>())),SyncWorkspace.Json)));}
  public Task<bool> MutateFolderAsync(FolderMutation m,CancellationToken c)
  {
   if(m.Delete&&Occupied)return Task.FromResult(false);
   if(m.Delete){Deletes++;Folders.Remove(m.Path);}else{Creates++;Folders.Add(m.Path);}
   if(LoseReply){LoseReply=false;throw new IOException("lost folder reply");}return Task.FromResult(true);
  }
 }
}
