using Spire.Core;
using System.Text.Json;
static class AssetTests
{
 static void Check(bool v,string message){if(!v)throw new Exception(message);}
 static JsonElement J(object v)=>JsonSerializer.SerializeToElement(v,SyncWorkspace.Json);
 public static async Task Run()
 {
  var root=Path.Combine(Path.GetTempPath(),"spire-assets-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(root);var engine=await NativeWorkspace.OpenAsync(store);
   var file=new ServerFile(Guid.NewGuid(),0,"Writing/Media.md","![image](../Attachments/image.png)",false,"",J(Array.Empty<object>()));
   byte[] bytes=[137,80,78,71,1,2,3];
   await engine.AttachAsync(file,"Attachments/image.png",bytes);
   engine=await NativeWorkspace.OpenAsync(store);
   Check(engine.State.PendingAssets.Single()=="Attachments/image.png"&&engine.State.Outbox.Single().Content==file.Content,"Attachment and insertion not atomic on restart");
   var fake=new Fake();fake.Disconnect=true;
   try{await engine.SyncAsync(fake);throw new Exception("Lost reply expected");}catch(IOException){}
   Check(engine.State.PendingAssets.Count==1&&engine.State.Outbox.Count==1,"Interrupted asset lost pending work");
   fake.Disconnect=false;await engine.SyncAsync(fake);
   Check(fake.Uploads==1&&engine.State.PendingAssets.Count==0&&engine.State.Outbox.Count==0,"Asset retry was not idempotent");
   Check(Convert.FromBase64String(engine.State.Assets["Attachments/image.png"]).SequenceEqual(bytes),"Cached bytes changed");
   fake.Assets["Attachments/remote.bin"]=[8,9,10];await engine.SyncAsync(fake);
   Check(Convert.FromBase64String(engine.State.Assets["Attachments/remote.bin"]).SequenceEqual(new byte[]{8,9,10}),"Inbound asset missing");
   fake.BadSize=true;var state=engine.State;
   bool bad=false;try{await engine.SyncAsync(fake);}catch(InvalidDataException){bad=true;}Check(bad&&engine.State.Snapshot!.Value.GetRawText()==state.Snapshot!.Value.GetRawText(),"Invalid asset pull replaced snapshot");
   Console.WriteLine("PASS: atomic attachment/file insertion; restart; upload lost-reply reconciliation; inbound asset bytes; invalid-size snapshot refusal");
  }finally{Directory.Delete(root,true);}
 }
 sealed class Fake:ISyncTransport,ISyncAssetTransport
 {
  public Dictionary<string,byte[]> Assets=[];public bool Disconnect,BadSize;public int Uploads;ServerFile? file;
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(J(new{owner="asset-owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(J(new{notes=file is null?Array.Empty<ServerFile>():new[]{file},attachments=Assets.Select(a=>new{path=a.Key,size=a.Value.Length+(BadSize?1:0)}).ToArray(),future=new{preserve=true}}));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement input,CancellationToken c)
  {
   var m=input.Deserialize<FileMutation>(SyncWorkspace.Json)!;
   Check(Assets.ContainsKey("Attachments/image.png"),"File sent before attachment");
   file=new(m.Id,1,m.Path,m.Content,m.Deleted,"",J(Array.Empty<object>()));return Task.FromResult((false,J(file)));
  }
  public Task<byte[]?> DownloadAssetAsync(string path,CancellationToken c)=>Task.FromResult(Assets.TryGetValue(path,out var data)?data:null);
  public Task UploadAssetAsync(string path,byte[] bytes,CancellationToken c){Uploads++;Assets[path]=bytes;if(Disconnect)throw new IOException("upload reply lost");return Task.CompletedTask;}
 }
}
