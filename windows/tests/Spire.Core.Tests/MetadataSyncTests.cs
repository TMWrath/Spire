using Spire.Core;
using System.Text.Json;
using System.Text.Json.Nodes;
static class MetadataSyncTests
{
 static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
 public static async Task Run()
 {
  var root=Path.Combine(Path.GetTempPath(),"spire-library-tests-"+Guid.NewGuid());Directory.CreateDirectory(root);
  try
  {
   var id=Guid.NewGuid().ToString();var sourceId=Guid.NewGuid().ToString();
   var template=Json(new{id,title="Original",category="section",sourcePath="Writing/A.md",content="# Old",created="2026-01-01T00:00:00Z",future=new{preserve=true}});
   var source=Json(new{id=sourceId,title="Book",kind="book",revision=1,created="2026-01-01T00:00:00Z",author="Author",year="2026",edition="",publisher="",isbn="",url="",accessed="",attachment="",description=""});
   var store=new NativeWorkspaceStore(root);await store.SaveAsync(SyncWorkspace.Empty.Receive(Json(new{notes=Array.Empty<object>(),templates=new[]{template},sources=new[]{source},futureTop=new{keep=1}})));
   var workspace=await NativeWorkspace.OpenAsync(store);var changed=JsonNode.Parse(template.GetRawText())!.AsObject();changed["content"]="# New";
   await workspace.EditLibraryAsync("templates",JsonSerializer.SerializeToElement(changed));
   if(workspace.State.Library("templates").Single().GetProperty("content").GetString()!="# New")throw new Exception("Template draft not visible offline");
   workspace=await NativeWorkspace.OpenAsync(store);if(workspace.State.MetadataOutbox.Count!=1)throw new Exception("Template outbox not durable");
   var remote=new Fake(workspace.State.Snapshot!.Value){LoseReply=true};
   bool failed=false;try{await workspace.SyncAsync(remote);}catch(IOException){failed=true;}
   if(!failed||workspace.State.MetadataOutbox.Count!=1||remote.Calls!=1)throw new Exception("Metadata lost reply erased pending update");
   await workspace.SyncAsync(remote);
   if(workspace.State.MetadataOutbox.Count!=0||remote.Calls!=1||!workspace.State.Library("templates").Single().GetProperty("future").GetProperty("preserve").GetBoolean())throw new Exception("Metadata replay duplicated or dropped unknown fields");
   var changedSource=JsonNode.Parse(source.GetRawText())!.AsObject();changedSource["title"]="Local title";await workspace.EditLibraryAsync("sources",JsonSerializer.SerializeToElement(changedSource));
   remote.Root["sources"]![0]!["revision"]=2;remote.Root["sources"]![0]!["title"]="Server title";
   await workspace.SyncAsync(remote);
   if(workspace.State.MetadataConflicts.Count!=1||workspace.State.Library("sources").Single().GetProperty("title").GetString()!="Local title")throw new Exception("Source conflict overwrote local draft");
   await workspace.ResolveLibraryAsync(workspace.State.MetadataConflicts.Single().Operation.Id,true);await workspace.SyncAsync(remote);
   if(workspace.State.MetadataConflicts.Count!=0||remote.Root["sources"]![0]!["title"]!.GetValue<string>()!="Local title")throw new Exception("Explicit source resolution failed");
   changed["content"]="# Another edit";await workspace.EditLibraryAsync("templates",JsonSerializer.SerializeToElement(changed));
   int beforeCalls=remote.Calls;remote.Owner="wrong-owner";bool isolated=false;try{await workspace.SyncAsync(remote);}catch(InvalidOperationException){isolated=true;}
   if(!isolated||remote.Calls!=beforeCalls||workspace.State.MetadataOutbox.Count!=1)throw new Exception("Metadata account isolation failed");remote.Owner="owner";
   remote.FailConflict=true;await workspace.SyncAsync(remote);if(workspace.State.MetadataConflicts.Count!=1)throw new Exception("HTTP metadata CAS conflict was discarded");
   await workspace.ResolveLibraryAsync(workspace.State.MetadataConflicts.Single().Operation.Id,false);
   if(workspace.State.MetadataConflicts.Count!=0||workspace.State.Library("templates").Single().GetProperty("content").GetString()!="# New")throw new Exception("Accept server metadata failed");
   store.BeforeCommit=()=>throw new IOException("injected");changed["content"]="# Unsaved";failed=false;
   try{await workspace.EditLibraryAsync("templates",JsonSerializer.SerializeToElement(changed));}catch(IOException){failed=true;}
   if(!failed||workspace.State.MetadataOutbox.Count!=0||workspace.State.Library("templates").Single().GetProperty("content").GetString()!="# New")throw new Exception("Failed metadata commit changed active state");
   Console.WriteLine("PASS: offline durable template update, metadata lost-reply reconciliation, unknown field retention, source CAS conflict and explicit resolution, atomic failed metadata save");
  }finally{Directory.Delete(root,true);}
 }
 sealed class Fake(JsonElement snapshot):ISyncTransport,IMetadataSyncTransport
 {
  public JsonObject Root=JsonNode.Parse(snapshot.GetRawText())!.AsObject();public int Calls;public bool LoseReply;public bool FailConflict;public string Owner="owner";
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(Json(new{owner=Owner}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement m,CancellationToken c)=>throw new Exception("No file edits expected");
  public Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation m,CancellationToken c)
  {
   Calls++;if(FailConflict){FailConflict=false;return Task.FromResult((true,Json(new{error="conflict"})));}var array=Root[m.Collection]!.AsArray();int index=Enumerable.Range(0,array.Count).Single(i=>array[i]!["id"]!.GetValue<string>()==m.RecordId);
   var result=JsonNode.Parse(m.Value.GetRawText())!.AsObject();if(m.Collection=="sources")result["revision"]=array[index]!["revision"]!.GetValue<int>()+1;array[index]=result;
   if(LoseReply){LoseReply=false;throw new IOException("lost reply");}return Task.FromResult((false,JsonSerializer.SerializeToElement(result)));
  }
 }
}
