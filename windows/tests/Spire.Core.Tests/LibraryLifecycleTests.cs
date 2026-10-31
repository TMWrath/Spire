using Spire.Core;
using System.Text.Json;
using System.Text.Json.Nodes;
static class LibraryLifecycleTests
{
 static JsonElement J(object v)=>JsonSerializer.SerializeToElement(v,SyncWorkspace.Json);
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static async Task Run()
 {
  var dir=Path.Combine(Path.GetTempPath(),"spire-lifecycle-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(dir);var w=await NativeWorkspace.OpenAsync(store);
   var template=LibraryRules.NewRecord("templates");var node=JsonNode.Parse(template.GetRawText())!.AsObject();node["title"]="Chapter";node["content"]="# Chapter";
   template=J(node);await w.CreateLibraryAsync("templates",template);
   Check(w.State.Library("templates").Count==1,"Offline template creation invisible");
   w=await NativeWorkspace.OpenAsync(store);Check(w.State.MetadataOutbox.Count==1,"Creation not durable");
   node["content"]="# Edited before sync";await w.EditLibraryAsync("templates",J(node));
   Check(w.State.MetadataOutbox.Single().Kind=="create","Edit converted unsynced creation into update");
   var file=new ServerFile(Guid.NewGuid(),0,"Writing/A.md","Body",false,"",J(Array.Empty<object>()),["saved-"+template.GetProperty("id").GetString()]);await w.EditAsync(file);
   var fake=new Fake{LoseReply=true};bool failed=false;try{await w.SyncAsync(fake);}catch(IOException){failed=true;}
   Check(failed&&fake.Calls==1&&w.State.MetadataOutbox.Count==1,"Lost creation reply discarded draft");
   w=await NativeWorkspace.OpenAsync(store);await w.SyncAsync(fake);
   Check(fake.Calls==1&&w.State.MetadataOutbox.Count==0,"Creation retry duplicated template");
   var remoteId=w.State.Library("templates").Single().GetProperty("id").GetString();
   Check(remoteId!=template.GetProperty("id").GetString()&&w.State.VisibleFiles().Single().TemplateIds!.Single()=="saved-"+remoteId,"Template provenance not rebound atomically");
   Check(w.State.Library("templates").Single().GetProperty("future").GetBoolean(),"Unknown acknowledgement field lost");
   var source=LibraryRules.NewRecord("sources");node=JsonNode.Parse(source.GetRawText())!.AsObject();node["title"]="Book";source=J(node);fake.Root["sources"]!.AsArray().Add(JsonNode.Parse(source.GetRawText()));await w.SyncAsync(fake);
   var cited=file with{Content=PortableCitations.Insert(source,file.Path,"","")};await w.EditAsync(cited);
   bool rejected=false;try{await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);}catch(InvalidOperationException){rejected=true;}
   Check(rejected,"Cited source deletion accepted");await w.EditAsync(cited with{Deleted=true});rejected=false;
   try{await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);}catch(InvalidOperationException){rejected=true;}Check(rejected,"Trash citation ignored");
   await w.EditAsync(cited with{Content="No citation",Deleted=false});await w.SyncAsync(fake);
   await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);Check(w.State.Library("sources").Count==0,"Pending deletion not hidden");
   fake.LoseReply=true;failed=false;try{await w.SyncAsync(fake);}catch(IOException){failed=true;}Check(failed,"Deletion failure not exercised");int calls=fake.Calls;await w.SyncAsync(fake);Check(fake.Calls==calls&&w.State.MetadataOutbox.Count==0,"Deleted source replay was not reconciled");
   fake.Root["sources"]!.AsArray().Add(JsonNode.Parse(source.GetRawText()));await w.SyncAsync(fake);await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);fake.Root["sources"]![0]!["revision"]=2;await w.SyncAsync(fake);
   Check(w.State.MetadataConflicts.Count==1,"Concurrent delete/edit did not conflict");await w.ResolveLibraryAsync(w.State.MetadataConflicts.Single().Operation.Id,false);Check(w.State.Library("sources").Count==1,"Accept remote deletion conflict lost source");
   source=w.State.Library("sources").Single();await w.EditAsync(cited with{Content=PortableCitations.Insert(source,file.Path,"","")});await w.SyncAsync(fake);
   await w.EditAsync(cited with{Content="Citation removed locally"});await w.DeleteLibraryAsync("sources",source.GetProperty("id").GetString()!);await w.SyncAsync(fake);
   Check(w.State.MetadataConflicts.Count==0&&w.State.MetadataOutbox.Count==0&&w.State.Library("sources").Count==0,"Deletion ran before pending citation removal");
   node=JsonNode.Parse(template.GetRawText())!.AsObject();node["title"]="Atomic new template";template=J(node);
   store.BeforeCommit=()=>throw new IOException("injected");failed=false;try{await w.CreateLibraryAsync("templates",template);}catch(IOException){failed=true;}Check(failed&&w.State.MetadataOutbox.Count==0,"Failed creation commit changed state");
   Console.WriteLine("PASS: offline template creation/edit/restart, generated-ID rebinding, lost-reply reconciliation, source deletion guards including Trash, delete/edit conflict, atomic creation failure");
  }finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}
 }
 sealed class Fake:ISyncTransport,IMetadataSyncTransport
 {
  public JsonObject Root=new(){["notes"]=new JsonArray(),["templates"]=new JsonArray(),["sources"]=new JsonArray()};public int Calls;public bool LoseReply;
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(J(new{owner="owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(J(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement m,CancellationToken c)
  {
   var f=m.Deserialize<FileMutation>(SyncWorkspace.Json)!;var file=new ServerFile(f.Id,f.Base+1,f.Path,f.Content,f.Deleted,"",J(Array.Empty<object>()),f.TemplateIds);var a=Root["notes"]!.AsArray();for(int i=a.Count-1;i>=0;i--)if(a[i]!["id"]!.GetValue<Guid>()==f.Id)a.RemoveAt(i);a.Add(JsonNode.Parse(J(file).GetRawText()));return Task.FromResult((false,J(file)));
  }
  public Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation m,CancellationToken c)
  {
   Calls++;var array=Root[m.Collection]!.AsArray();JsonElement result;
   if(m.Kind=="delete"){
    if(Root["notes"]!.AsArray().Any(n=>PortableCitations.Read(n!["content"]!.GetValue<string>()).Any(citation=>citation.SourceId.ToString()==m.RecordId)))return Task.FromResult((true,J(new{error="cited"})));
    var old=array.Single(r=>r!["id"]!.GetValue<string>()==m.RecordId);array.Remove(old);result=J(new{ok=true});}
   else{var node=JsonNode.Parse(m.Value.GetRawText())!.AsObject();node["id"]=Guid.NewGuid().ToString();node["future"]=true;array.Add(node);result=J(node);}
   if(LoseReply){LoseReply=false;throw new IOException("reply lost");}return Task.FromResult((false,result));
  }
 }
}
