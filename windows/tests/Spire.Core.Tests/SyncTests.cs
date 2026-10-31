using Spire.Core;
using System.Text.Json;

static class SyncTests
{
 static JsonElement J(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static async Task Run()
 {
  foreach(var bad in new[]{"Writing/CON.md","Writing/trailing./file.md","Writing/a .md ","Writing/%escape.md","Writing/.hidden.md","Writing/line\n.md"})
  {bool rejected=false;try{LocalFiles.ValidatePath(bad);}catch(ArgumentException){rejected=true;}Check(rejected,"Portable path accepted: "+bad);}
  var file=new ServerFile(Guid.NewGuid(),3,"Writing/Test.md","draft",false,"",J(Array.Empty<object>()));
  foreach(var invalid in new object[]{new{notes=new[]{file with{Path="../unsafe.md"}}},new{notes=new[]{file,file}},new{notes=new[]{file,file with{Id=Guid.NewGuid(),Path="writing/test.md"}}}})
  {
   bool rejected=false;try{SyncWorkspace.Empty.Receive(J(invalid));}catch(InvalidDataException){rejected=true;}Check(rejected,"Unsafe or colliding server snapshot accepted");
  }
  var transport=new Fake(file);
  var initial=SyncWorkspace.Empty.Receive(J(new{notes=new[]{file with{Content="base"}},futureMetadata=new{opaque="retained"}})).BindOwner("a").Queue(file);
  var persisted=initial;
  var coordinator=new SyncCoordinator(transport,s=>{persisted=s;return Task.CompletedTask;});
  transport.FailSnapshot=true;
  try{await coordinator.RunAsync(initial);throw new Exception("Snapshot failure expected");}catch(IOException){}
  Check(persisted.Outbox.Count==0,"Acknowledgement not persisted");
  Check(persisted.VisibleFiles().Single().Content=="draft","Acknowledged draft vanished on failed snapshot");
  Check(persisted.Snapshot!.Value.GetProperty("futureMetadata").GetProperty("opaque").GetString()=="retained","Unknown metadata lost");
  transport.FailSnapshot=false;
  var received=await coordinator.RunAsync(persisted);
  Check(received.VisibleFiles().Single().Rev==4,"Server revision missing");
  Check(transport.Mutations==1,"Acknowledged operation replayed");
  transport.FailAfterCommit=true;
  var queued=received.Queue(received.VisibleFiles().Single() with{Content="retry"});persisted=queued;
  try{await coordinator.RunAsync(queued);throw new Exception("Disconnect expected");}catch(IOException){}
  Check(persisted.Outbox.Single().Op==queued.Outbox.Single().Op,"Retry identity lost");
  transport.FailAfterCommit=false;
  received=await coordinator.RunAsync(persisted);
  Check(received.VisibleFiles().Single().Rev==5,"Idempotent retry revised twice");
  transport.File=transport.File with{Rev=6,Content="other device"};
  queued=received.Queue(received.VisibleFiles().Single() with{Content="conflicted draft"});
  received=await coordinator.RunAsync(queued);
  Check(received.Conflicts.Count==1,"Conflict missing");
  Check(received.VisibleFiles().Single().Content=="conflicted draft","Conflict draft no longer visible");
  var conflictId=received.Conflicts.Single().GetProperty("id").GetString()!;
  received=received.ResolveConflict(conflictId,false);
  Check(received.VisibleFiles().Single().Content=="other device","Remote resolution not explicit");
  queued=received.Queue(received.VisibleFiles().Single() with{Content="kept local"});
  transport.File=transport.File with{Rev=7};received=await coordinator.RunAsync(queued);
  received=received.ResolveConflict(received.Conflicts.Single().GetProperty("id").GetString()!,true);
  Check(received.Outbox.Single().Base==7&&received.Outbox.Single().Content=="kept local","Keep-local did not rebase");
  received=await coordinator.RunAsync(received);
  Check(received.VisibleFiles().Single().Content=="kept local","Resolved draft not synchronized");
  transport.Owner="b";bool isolated=false;try{await coordinator.RunAsync(received);}catch(InvalidOperationException){isolated=true;}Check(isolated,"Account switch accepted");
  transport.Owner="a";transport.Revoked=true;bool revoked=false;try{await coordinator.RunAsync(received);}catch(UnauthorizedAccessException){revoked=true;}Check(revoked,"Revocation ignored");
  var root=Path.Combine(Path.GetTempPath(),"spire-engine-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(root);
   var engine=await NativeWorkspace.OpenAsync(store);
   await engine.EditAsync(file with{Rev=0});
   store=new NativeWorkspaceStore(root);
   engine=await NativeWorkspace.OpenAsync(store);
   Check(engine.State.Outbox.Single().Content=="draft","Durable edit/outbox restart lost");
   var before=engine.State;
   store.BeforeCommit=()=>throw new IOException("disk full");
   bool failed=false;try{await engine.EditAsync(file with{Content="not committed"});}catch(IOException){failed=true;}
   Check(failed&&engine.State==before,"Failed commit changed memory");
   Check((await new NativeWorkspaceStore(root).LoadAsync()).Outbox.Single().Content=="draft","Failed commit changed disk");
  }finally{Directory.Delete(root,true);}
  Console.WriteLine("PASS: portable paths; durable acknowledged draft on failed pull; idempotent disconnect retry; conflicts and explicit resolutions; account isolation/revocation; atomic engine restart/failure");
 }
 sealed class Fake(ServerFile file):ISyncTransport
 {
  public ServerFile File=file; public string Owner="a"; public bool Revoked,FailSnapshot,FailAfterCommit;public int Mutations;
  readonly Dictionary<Guid,ServerFile> operations=[];
  public Task<JsonElement> IdentityAsync(CancellationToken c){if(Revoked)throw new UnauthorizedAccessException();return Task.FromResult(J(new{owner=Owner}));}
  public Task<JsonElement> SnapshotAsync(CancellationToken c){if(FailSnapshot)throw new IOException("pull disconnected");return Task.FromResult(J(new{notes=new[]{File},attachments=Array.Empty<object>()}));}
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement input,CancellationToken c)
  {
   var m=input.Deserialize<FileMutation>(SyncWorkspace.Json)!;Mutations++;
   if(operations.TryGetValue(m.Op,out var done))return Task.FromResult((false,J(done)));
   if(m.Base!=File.Rev)return Task.FromResult((true,J(new{details=new{id=Guid.NewGuid().ToString(),mutation=m,current=File.Rev,time=""}})));
   File=File with{Content=m.Content,Path=m.Path,Deleted=m.Deleted,Rev=File.Rev+1};operations[m.Op]=File;
   if(FailAfterCommit)throw new IOException("reply lost");return Task.FromResult((false,J(File)));
  }
 }
}
