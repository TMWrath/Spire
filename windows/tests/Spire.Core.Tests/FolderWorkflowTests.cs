using Spire.Core;
using System.Text.Json;
using System.Text.Json.Nodes;
static class FolderWorkflowTests
{
 static JsonElement J(object v)=>JsonSerializer.SerializeToElement(v,SyncWorkspace.Json);
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static async Task Run()
 {
  var dir=Path.Combine(Path.GetTempPath(),"spire-folder-workflow-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(dir);var w=await NativeWorkspace.OpenAsync(store);
   ServerFile File(string p,string text)=>new(Guid.NewGuid(),0,p,text,false,"",J(Array.Empty<object>()));
   ServerFile a=File("Old/Sub/A.md","[[B|named]]\n![image](../../Attachments/p.png)\n<audio controls src=\"../../Attachments/s.mp3\"></audio>\n```\n[[B]]\n```\n"),b=File("Other/B.md","[A](../Old/Sub/A.md#section)"),trash=File("Old/Trash.md","Trash untouched") with{Deleted=true};
   await w.CreateFolderAsync("Old");await w.CreateFolderAsync("Old/Sub");await w.CreateFolderAsync("Old/Empty");await w.EditAsync(a);await w.EditAsync(b);await w.EditAsync(trash);
   await w.MoveFolderAsync("Old","Destination/Deep");
   var moved=w.State.VisibleFiles().Single(f=>f.Id==a.Id);Check(moved.Path=="Destination/Deep/Sub/A.md"&&moved.Content.Contains("[[Other/B|named]]")&&moved.Content.Contains("../../../Attachments/p.png")&&moved.Content.Contains("../../../Attachments/s.mp3")&&moved.Content.Contains("```\n[[B]]\n```"),"Move lost writing, references, media or code");
   Check(w.State.VisibleFiles().Single(f=>f.Id==b.Id).Content.Contains("../Destination/Deep/Sub/A.md#section"),"Incoming link not repaired");Check(w.State.VisibleFiles().Single(f=>f.Id==trash.Id).Path==trash.Path,"Move altered pre-existing Trash");
   Check(w.State.Folders().Contains("Destination/Deep/Empty")&&!w.State.Folders().Contains("Old"),"Empty descendants or parent overlay lost");
   w=await NativeWorkspace.OpenAsync(store);Check(w.State.VisibleFiles().Single(f=>f.Id==a.Id).Path==moved.Path,"Move was not durable");
   var frozen=J(w.State).GetRawText();store.BeforeCommit=()=>throw new IOException("disk full");try{await w.TrashFolderAsync("Destination/Deep");throw new Exception("Expected disk failure");}catch(IOException){}Check(J(w.State).GetRawText()==frozen,"Failed folder transaction changed memory");store.BeforeCommit=null;
   await w.TrashFolderAsync("Destination/Deep");Check(w.State.VisibleFiles().Single(f=>f.Id==a.Id).Deleted&&!w.State.VisibleFiles().Single(f=>f.Id==b.Id).Deleted,"Folder trash included unrelated files");
   await w.CreateFolderAsync("Guard");var imageFile=File("Guard/A.md","");await w.EditAsync(imageFile);await w.AttachAsync(imageFile,"Guard/p.png",[1,2,3]);frozen=J(w.State).GetRawText();
   try{await w.TrashFolderAsync("Guard");throw new Exception("Attachments must guard deletion");}catch(InvalidOperationException){}Check(J(w.State).GetRawText()==frozen,"Rejected folder action mutated workspace");
   try{await w.MoveFolderAsync("Guard","Guard/Sub");throw new Exception("Recursive destination accepted");}catch(ArgumentException){}
   // A synchronized subtree can be locally planned atomically while each remote file retains CAS.
   var fake=new Fake();var initial=SyncWorkspace.Empty.Receive(J(new{notes=new[]{File("Tree/Sub/C.md","C") with{Rev=1}},folders=new[]{"Tree","Tree/Sub"},future=new{preserved=true}}));var dir2=Path.Combine(dir,"synced");var s2=new NativeWorkspaceStore(dir2);await s2.SaveAsync(initial);var w2=await NativeWorkspace.OpenAsync(s2);fake.Root=JsonNode.Parse(initial.Snapshot!.Value.GetRawText())!.AsObject();await w2.MoveFolderAsync("Tree","New");fake.LoseReply=true;
   try{await w2.SyncAsync(fake);}catch(IOException){}w2=await NativeWorkspace.OpenAsync(s2);await w2.SyncAsync(fake);Check(w2.State.Outbox.Count==0&&w2.State.FolderOutbox.Count==0&&w2.State.VisibleFiles().Single().Path=="New/Sub/C.md"&&fake.FileWrites==1,"Folder retry duplicated file or left folder operations");Check(w2.State.Snapshot!.Value.GetProperty("future").GetProperty("preserved").GetBoolean(),"Unknown snapshot metadata lost");
   Console.WriteLine("PASS: atomic offline nonempty folder move/trash/restart/failure, empty descendants, inbound/outbound/media link repair excluding code, Trash isolation, attachment/recursive guards and deterministic CAS lost-reply retry");
  }finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}
 }
 sealed class Fake:ISyncTransport,IFolderSyncTransport
 {
  public JsonObject Root=new();public int FileWrites;public bool LoseReply;readonly Dictionary<Guid,JsonElement> acks=[];
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(J(new{owner="folder-owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(J(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement value,CancellationToken c)
  {var m=value.Deserialize<FileMutation>(SyncWorkspace.Json)!;if(acks.TryGetValue(m.Op,out var reply))return Task.FromResult((false,reply));FileWrites++;var file=new ServerFile(m.Id,m.Base+1,m.Path,m.Content,m.Deleted,"",J(Array.Empty<object>()));var a=Root["notes"]!.AsArray();for(int i=a.Count-1;i>=0;i--)if(a[i]!["id"]!.GetValue<Guid>()==m.Id)a.RemoveAt(i);a.Add(JsonNode.Parse(J(file).GetRawText()));acks[m.Op]=J(file);if(LoseReply){LoseReply=false;throw new IOException("file reply lost");}return Task.FromResult((false,J(file)));}
  public Task<bool> MutateFolderAsync(FolderMutation m,CancellationToken c)
  {var a=Root["folders"]!.AsArray();if(m.Delete){if(a.Any(f=>f!.GetValue<string>().StartsWith(m.Path+"/"))||Root["notes"]!.AsArray().Any(f=>!f!["deleted"]!.GetValue<bool>()&&f["path"]!.GetValue<string>().StartsWith(m.Path+"/")))return Task.FromResult(false);for(int i=a.Count-1;i>=0;i--)if(a[i]!.GetValue<string>()==m.Path)a.RemoveAt(i);}else if(!a.Any(f=>f!.GetValue<string>()==m.Path))a.Add(m.Path);return Task.FromResult(true);}
 }
}
