using Spire.Core;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net;
static class SourceCreationTests
{
 static JsonElement J(object v)=>JsonSerializer.SerializeToElement(v,SyncWorkspace.Json);
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static async Task Run()
 {
  var dir=Path.Combine(Path.GetTempPath(),"spire-source-create-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(dir);var w=await NativeWorkspace.OpenAsync(store);
   var n=JsonNode.Parse(LibraryRules.NewRecord("sources").GetRawText())!.AsObject();n["title"]="Native book";n["author"]="Author";n["future"]=J(new{keep=true}).GetRawText();var source=J(n);var provisional=source.GetProperty("id").GetString()!;
   await w.CreateLibraryAsync("sources",source);Check(w.State.Library("sources").Count==1,"Offline source invisible");
   w=await NativeWorkspace.OpenAsync(store);n["description"]="Edited offline";await w.EditLibraryAsync("sources",J(n));source=w.State.Library("sources").Single();
   var quote=PortableCitations.Insert(source,"Writing/Nested/A.md","p. 3","Historical quote");
   var code="\n```\n"+quote+"\n```\n";
   var file=new ServerFile(Guid.NewGuid(),0,"Writing/Nested/A.md",quote+code,false,"",J(Array.Empty<object>()));await w.EditAsync(file);
   var fake=new Fake();await w.SyncAsync(fake);var actual=w.State.Library("sources").Single();var remoteId=actual.GetProperty("id").GetString()!;
   Check(remoteId!=provisional&&fake.Calls==1&&w.State.MetadataOutbox.Count==0,"Source POST/ack not applied");
   var saved=w.State.VisibleFiles().Single();Check(PortableCitations.Read(saved.Content).Single().SourceId.ToString()==remoteId&&saved.Content.EndsWith(code),"Citation ID remap changed protected code or failed");Check(actual.GetProperty("future").GetBoolean(),"Unknown acknowledgement lost");
   n=JsonNode.Parse(LibraryRules.NewRecord("sources").GetRawText())!.AsObject();n["title"]="Lost acknowledgement";source=J(n);await w.CreateLibraryAsync("sources",source);fake.LoseReply=true;
   try{await w.SyncAsync(fake);throw new Exception("Missing failure");}catch(IOException){}
   w=await NativeWorkspace.OpenAsync(store);int calls=fake.Calls;await w.SyncAsync(fake);
   Check(fake.Calls==calls&&w.State.MetadataConflicts.Count==1&&w.State.MetadataOutbox.Count==0,"Uncertain source POST was replayed or not exposed");
   var c=w.State.MetadataConflicts.Single();Check(c.Remote is not null,"Matching recovery candidate missing");await w.ResolveLibraryAsync(c.Operation.Id,true);
   Check(w.State.MetadataConflicts.Count==0&&w.State.Library("sources").Count==2,"Explicit candidate adoption failed");await w.SyncAsync(fake);Check(fake.Calls==calls,"Candidate adoption sent duplicate POST");
   // Failure before the remote commit must not silently retry a non-idempotent POST either.
   n=JsonNode.Parse(LibraryRules.NewRecord("sources").GetRawText())!.AsObject();n["title"]="Never reached server";source=J(n);await w.CreateLibraryAsync("sources",source);fake.FailBefore=true;
   try{await w.SyncAsync(fake);}catch(IOException){}calls=fake.Calls;await w.SyncAsync(fake);c=w.State.MetadataConflicts.Single();Check(c.Remote is null&&fake.Calls==calls,"No-candidate uncertainty silently retried");
   await w.ResolveLibraryAsync(c.Operation.Id,true);await w.SyncAsync(fake);Check(fake.Calls==calls+1&&w.State.MetadataConflicts.Count==0,"Explicit retry did not create source");
   // Cancelling a never-dispatched creation is local, not DELETE of a nonexistent server ID.
   n=JsonNode.Parse(LibraryRules.NewRecord("sources").GetRawText())!.AsObject();n["title"]="Cancelled";source=J(n);await w.CreateLibraryAsync("sources",source);await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);Check(w.State.MetadataOutbox.Count==0,"Unsent creation cancellation queued DELETE");
   store.BeforeCommit=()=>throw new IOException("disk full");try{await w.CreateLibraryAsync("sources",source);}catch(IOException){}Check(w.State.MetadataOutbox.Count==0,"Failed creation changed memory");store.BeforeCommit=null;
   var handler=new PostHandler();using var http=new ServerClient(new Uri("https://spire.invalid/"),handler);await http.LoginAsync("test","test","test");await http.UpdateMetadataAsync(new(Guid.NewGuid(),"sources",provisional,J((object?)null!),source){Kind="create"});Check(handler.Posted,"Source create route not called");
   Console.WriteLine("PASS: offline source create/edit/restart, strict POST contract, generated-ID citation remap excluding code, uncertain reply explicit adoption/retry without automatic duplication, unsent cancellation and atomic failure");
  }finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}
 }
 sealed class Fake:ISyncTransport,IMetadataSyncTransport
 {
  public JsonObject Root=new(){["notes"]=new JsonArray(),["sources"]=new JsonArray(),["templates"]=new JsonArray()};public int Calls;public bool LoseReply,FailBefore;
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(J(new{owner="source-owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(J(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement e,CancellationToken c){var m=e.Deserialize<FileMutation>(SyncWorkspace.Json)!;var f=new ServerFile(m.Id,m.Base+1,m.Path,m.Content,m.Deleted,"",J(Array.Empty<object>()));Root["notes"]=new JsonArray(JsonNode.Parse(J(f).GetRawText()));return Task.FromResult((false,J(f)));}
  public Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation m,CancellationToken c){Calls++;if(FailBefore){FailBefore=false;throw new IOException("before commit");}var n=JsonNode.Parse(m.Value.GetRawText())!.AsObject();n["id"]=Guid.NewGuid().ToString();n["future"]=true;Root["sources"]!.AsArray().Add(n);if(LoseReply){LoseReply=false;throw new IOException("reply lost");}return Task.FromResult((false,J(n)));}
 }
 sealed class PostHandler:HttpMessageHandler
 {
  public bool Posted;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c)
  {
   if(r.RequestUri!.AbsolutePath=="/api/sources")
   {Posted=true;Check(r.Method==HttpMethod.Post&&r.Headers.GetValues("X-CSRF-Token").Single()=="fake","Source method/CSRF");var b=JsonDocument.Parse(await r.Content!.ReadAsStringAsync(c)).RootElement;Check(b.EnumerateObject().Count()==LibraryRules.Fields("sources").Count&&!b.TryGetProperty("id",out _)&&!b.TryGetProperty("revision",out _)&&!b.TryGetProperty("future",out _),"Source strict input polluted");}
   return new(HttpStatusCode.OK){Content=new StringContent("{\"owner\":\"source-owner\",\"csrf\":\"fake\"}",System.Text.Encoding.UTF8,"application/json")};
  }
 }
}
