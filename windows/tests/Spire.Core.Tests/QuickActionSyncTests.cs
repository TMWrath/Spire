using Spire.Core;
using System.Text.Json;
using System.Text.Json.Nodes;
// Hosted parity regression coverage for server/store.ts quick action endpoints:
// durable order requests with conflicts and lost replies, activation op replay,
// deterministic server rejections, and delete/create lifecycle gates.
static class QuickActionSyncTests
{
 static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
 static JsonElement Action(Guid id,string label,string folder,string pattern)=>Json(new{id=id.ToString(),label,folder,namePattern=pattern,templateId=(string?)null,revision=1,created="2026-10-11T00:00:00Z"});
 static List<string> Order(SyncWorkspace state)=>state.Library("quickActions").Select(r=>r.GetProperty("id").GetString()!).ToList();
 static async Task ExpectAsync<T>(Func<Task> action,string? contains=null) where T:Exception
 {
  try{await action();}
  catch(T e){if(contains is not null&&!e.Message.Contains(contains,StringComparison.Ordinal))throw new Exception("Wrong failure message: "+e.Message);return;}
  catch(Exception e){throw new Exception("Unexpected "+e.GetType().Name+": "+e.Message);}
  throw new Exception("Expected "+typeof(T).Name);
 }
 public static async Task Run()
 {
  var root=Path.Combine(Path.GetTempPath(),"spire-quickaction-tests-"+Guid.NewGuid());Directory.CreateDirectory(root);
  try
  {
   var a=Guid.NewGuid();var b=Guid.NewGuid();var c=Guid.NewGuid();
   var snapshot=Json(new{notes=Array.Empty<object>(),quickActions=new[]{Action(a,"Alpha","Writing","Untitled {date}.md"),Action(b,"Beta","Writing","Note {time}.md"),Action(c,"Gamma","Journal","Page {date}")}});
   var store=new NativeWorkspaceStore(root);await store.SaveAsync(SyncWorkspace.Empty.Receive(snapshot));
   var workspace=await NativeWorkspace.OpenAsync(store);var fake=new QuickFake(snapshot);
   if(!workspace.State.CleanForActivation())throw new Exception("Fresh workspace must be clean for activation");

   // Pending stylesheet edit blocks activation; synchronizing drains it
   await workspace.QueueStyleAsync("Writing/Gate.css","h1{color:red}");
   await ExpectAsync<InvalidOperationException>(()=>workspace.ActivateQuickActionAsync(fake,a),"Sync and resolve pending changes");
   if(fake.Activations!=0)throw new Exception("Activation was attempted before the workspace was clean");
   await workspace.SyncAsync(fake);
   if(workspace.State.StyleOutbox.Count!=0||fake.Puts!=1||fake.Root["styles"]!["Writing/Gate.css"]!.GetValue<string>()!="h1{color:red}")throw new Exception("Gate style not synchronized");
   if(!workspace.State.CleanForActivation())throw new Exception("Style sync left the workspace dirty");

   // Pending order blocks activation; order sync applies exactly the requested contract
   await workspace.QueueQuickActionOrderAsync([b.ToString(),a.ToString(),c.ToString()]);
   await ExpectAsync<InvalidOperationException>(()=>workspace.ActivateQuickActionAsync(fake,a),"Sync and resolve pending changes");
   await workspace.SyncAsync(fake);
   if(workspace.State.QuickActionOrder is not null||fake.Orders!=1)throw new Exception("Quick action order not applied");
   if(!Order(workspace.State).SequenceEqual([b.ToString(),a.ToString(),c.ToString()]))throw new Exception("Local order not applied");
   if(fake.LastOrder is null||!fake.LastOrder.Value.Ids.SequenceEqual([b.ToString(),a.ToString(),c.ToString()])||!fake.LastOrder.Value.Expected.SequenceEqual([a.ToString(),b.ToString(),c.ToString()]))throw new Exception("Reorder request contract mismatch");

   // Independent server change becomes an explicit conflict; keep-local retries with the same ids
   await workspace.QueueQuickActionOrderAsync([c.ToString(),a.ToString(),b.ToString()]);
   fake.SetOrder(a.ToString(),b.ToString(),c.ToString());
   await workspace.SyncAsync(fake);
   if(fake.Orders!=1)throw new Exception("Order conflict must not send a request");
   var orderConflict=workspace.State.MetadataConflicts.SingleOrDefault();
   if(orderConflict is null||orderConflict.Operation.Kind!="order"||orderConflict.Reason!="Action order changed elsewhere")throw new Exception("Order conflict not recorded");
   if(!orderConflict.Remote!.Value.GetProperty("ids").EnumerateArray().Select(v=>v.GetString()).SequenceEqual([a.ToString(),b.ToString(),c.ToString()]))throw new Exception("Conflict must capture the server order");
   if(!orderConflict.Operation.Value.GetProperty("ids").EnumerateArray().Select(v=>v.GetString()).SequenceEqual([c.ToString(),a.ToString(),b.ToString()]))throw new Exception("Conflict must retain the requested order");
   await ExpectAsync<InvalidOperationException>(()=>workspace.QueueQuickActionOrderAsync([b.ToString(),a.ToString(),c.ToString()]),"Resolve the pending quick action conflict");
   await workspace.ResolveLibraryAsync(orderConflict.Operation.Id,true);
   if(workspace.State.QuickActionOrder is null||!workspace.State.QuickActionOrder.Ids.SequenceEqual([c.ToString(),a.ToString(),b.ToString()]))throw new Exception("Keep-local did not requeue the requested order");
   await workspace.SyncAsync(fake);
   if(fake.Orders!=2||workspace.State.MetadataConflicts.Count!=0||!Order(workspace.State).SequenceEqual([c.ToString(),a.ToString(),b.ToString()]))throw new Exception("Order conflict resolution failed");

   // Lost order reply: the request is retained and the replay is recognized, not re-sent
   await workspace.QueueQuickActionOrderAsync([b.ToString(),c.ToString(),a.ToString()]);
   fake.LoseOrderReply=true;
   await ExpectAsync<IOException>(()=>workspace.SyncAsync(fake));
   if(workspace.State.QuickActionOrder is null)throw new Exception("Lost order reply dropped the request");
   await workspace.SyncAsync(fake);
   // Two acknowledged PUTs plus the lost-reply PUT that was already applied; the retry drops
   // without a third request because the server order matches the requested ids.
   if(fake.Orders!=3||workspace.State.QuickActionOrder is not null||!Order(workspace.State).SequenceEqual([b.ToString(),c.ToString(),a.ToString()]))throw new Exception("Lost order reply was re-sent instead of recognized");

   // Corrupt order acknowledgement: retained and retried
   await workspace.QueueQuickActionOrderAsync([a.ToString(),c.ToString(),b.ToString()]);
   fake.BrokenOrderAck=true;
   await ExpectAsync<InvalidDataException>(()=>workspace.SyncAsync(fake),"acknowledgement");
   if(workspace.State.QuickActionOrder is null)throw new Exception("Invalid order ack dropped the request");
   await workspace.SyncAsync(fake);
   if(fake.Orders!=4||workspace.State.QuickActionOrder is not null||!Order(workspace.State).SequenceEqual([a.ToString(),c.ToString(),b.ToString()]))throw new Exception("Order retry failed");

   // Conflict can be discarded for the server order
   await workspace.QueueQuickActionOrderAsync([c.ToString(),b.ToString(),a.ToString()]);
   fake.SetOrder(a.ToString(),b.ToString(),c.ToString());
   await workspace.SyncAsync(fake);
   var discard=workspace.State.MetadataConflicts.SingleOrDefault();
   if(discard is null||discard.Operation.Kind!="order")throw new Exception("Second order conflict not recorded");
   await workspace.ResolveLibraryAsync(discard.Operation.Id,false);
   if(workspace.State.MetadataConflicts.Count!=0||workspace.State.QuickActionOrder is not null||!Order(workspace.State).SequenceEqual([a.ToString(),b.ToString(),c.ToString()]))throw new Exception("Discarded order conflict left residue");

   // Activation success: durable op, ledger, visible file
   var alpha=await workspace.ActivateQuickActionAsync(fake,a);
   if(alpha.ActionId!=a||alpha.Path!="Writing/Untitled 2026-10-11.md")throw new Exception("Activation record mismatch: "+alpha.Path);
   if(workspace.State.PendingActivations.Count!=0||workspace.State.ActivationLedger.Count!=1)throw new Exception("Activation ledger not recorded");
   if(workspace.State.ActivationLedger.Single() is not{ActionId:var la,Op:var lop,NoteId:var ln,Path:var lp}||la!=a||lop!=alpha.Op||ln!=alpha.NoteId||lp!="Writing/Untitled 2026-10-11.md")throw new Exception("Ledger entry mismatch");
   if(!workspace.State.VisibleFiles().Any(f=>f.Id==alpha.NoteId&&f.Path==alpha.Path))throw new Exception("Activated file not visible");
   if(fake.Activations!=1||fake.Done.Count!=1)throw new Exception("Server activation count");
   if(!workspace.State.CleanForActivation())throw new Exception("Activation left the workspace dirty");

   // Disconnection: the op id is durable and the retry replays the exact same identity
   fake.FailActivation=true;
   await ExpectAsync<IOException>(()=>workspace.ActivateQuickActionAsync(fake,b));
   var pendingOp=workspace.State.PendingActivations.SingleOrDefault(p=>p.ActionId==b)?.Op??throw new Exception("Pending activation missing");
   workspace=await NativeWorkspace.OpenAsync(store);
   if(workspace.State.PendingActivations.SingleOrDefault(p=>p.ActionId==b)?.Op!=pendingOp)throw new Exception("Pending activation is not durable with the same identity");
   var beta=await workspace.ActivateQuickActionAsync(fake,b);
   if(beta.Op!=pendingOp||beta.Path!="Writing/Note 12-00-00.md")throw new Exception("Activation retry mismatch: "+beta.Path);
   if(fake.Done.Values.Count(v=>v.ActionId==b)!=1)throw new Exception("Retry used a different operation identity");
   if(workspace.State.PendingActivations.Count!=0)throw new Exception("Retry left a pending activation");

   // Reply lost after the server applied: replay returns the same file without duplicating it
   fake.LoseActivationReply=true;
   await ExpectAsync<IOException>(()=>workspace.ActivateQuickActionAsync(fake,c));
   var gammaOp=workspace.State.PendingActivations.Single(p=>p.ActionId==c).Op;
   var gamma=await workspace.ActivateQuickActionAsync(fake,c);
   if(gamma.Op!=gammaOp||gamma.Path!="Journal/Page 2026-10-11.md")throw new Exception("Replayed activation mismatch: "+gamma.Path);
   if(fake.Root["notes"]!.AsArray().Count(n=>n!["path"]!.GetValue<string>().StartsWith("Journal/Page"))!=1)throw new Exception("Replayed activation duplicated the file");
   if(workspace.State.ActivationLedger.Count(l=>l.ActionId==c)!=1)throw new Exception("Replayed activation duplicated the ledger");

   // Requeueing the same op after success is an idempotent replay
   await workspace.QueueQuickActionActivationAsync(c,gammaOp);
   await workspace.SyncAsync(fake);
   if(workspace.State.PendingActivations.Count!=0||fake.Root["notes"]!.AsArray().Count(n=>n!["path"]!.GetValue<string>().StartsWith("Journal/Page"))!=1)throw new Exception("Replay after success duplicated work");
   if(workspace.State.ActivationLedger.Count(l=>l.Op==gammaOp)!=1)throw new Exception("Replay after success duplicated the ledger entry");

   // Server-side file removal turns a replay into an explicit conflict
   fake.RemoveNote(gamma.NoteId);
   await workspace.QueueQuickActionActivationAsync(c,gammaOp);
   await workspace.SyncAsync(fake);
   var gone=workspace.State.MetadataConflicts.SingleOrDefault();
   if(gone is null||gone.Operation.Kind!="activate"||gone.Reason!="Created file is no longer available.")throw new Exception("Missing replay target must conflict");
   if(gone.Operation.Value.GetProperty("op").GetString()!=gammaOp.ToString()||gone.Operation.Value.GetProperty("actionId").GetString()!=c.ToString())throw new Exception("Activation conflict must retain op and action identity");
   await workspace.ResolveLibraryAsync(gone.Operation.Id,false);
   if(workspace.State.MetadataConflicts.Count!=0)throw new Exception("Activation conflict not discarded");

   // Deterministic server rejection becomes a conflict; explicit retry reuses the op id
   fake.SetTemplate(c.ToString(),"missing-template");
   await ExpectAsync<InvalidOperationException>(()=>workspace.ActivateQuickActionAsync(fake,c));
   var template=workspace.State.MetadataConflicts.SingleOrDefault();
   if(template is null||template.Operation.Kind!="activate"||template.Reason!="The configured template is unavailable. Edit this action in Settings.")throw new Exception("Template rejection must conflict");
   if(workspace.State.PendingActivations.Count!=0)throw new Exception("Rejected activation must move to a conflict");
   var rejectedOp=Guid.Parse(template.Operation.Value.GetProperty("op").GetString()!);
   await workspace.ResolveLibraryAsync(template.Operation.Id,true);
   if(workspace.State.PendingActivations.Single(p=>p.ActionId==c).Op!=rejectedOp)throw new Exception("Retry must reuse the rejected op identity");
   await workspace.SyncAsync(fake);
   var template2=workspace.State.MetadataConflicts.SingleOrDefault();
   if(template2 is null||template2.Reason!="The configured template is unavailable. Edit this action in Settings."||Guid.Parse(template2.Operation.Value.GetProperty("op").GetString()!)!=rejectedOp)throw new Exception("Retry changed the operation identity");
   await workspace.ResolveLibraryAsync(template2.Operation.Id,false);
   if(fake.Root["notes"]!.AsArray().Any(n=>n!["path"]!.GetValue<string>().StartsWith("Journal/Page")))throw new Exception("Rejected activation must not create files");
   if(workspace.State.MetadataConflicts.Count!=0||workspace.State.PendingActivations.Count!=0)throw new Exception("Template rejection left residue");

   // Operation ids are bound to one action
   await workspace.QueueQuickActionActivationAsync(a,beta.Op);
   await workspace.SyncAsync(fake);
   var collision=workspace.State.MetadataConflicts.SingleOrDefault();
   if(collision is null||collision.Operation.Kind!="activate"||collision.Reason!="Operation ID already used for another quick action.")throw new Exception("Operation collision must conflict");
   await workspace.ResolveLibraryAsync(collision.Operation.Id,false);

   // Malformed acknowledgement retains the pending activation; retry succeeds with the same op
   fake.BadActivationAck=true;
   await ExpectAsync<InvalidDataException>(()=>workspace.ActivateQuickActionAsync(fake,a));
   if(workspace.State.PendingActivations.Count(p=>p.ActionId==a)!=1)throw new Exception("Invalid acknowledgement dropped the pending activation");
   var afterBad=await workspace.ActivateQuickActionAsync(fake,a);
   if(afterBad.Op!=workspace.State.ActivationLedger.Last(l=>l.ActionId==a).Op)throw new Exception("Retry after bad ack changed identity");
   if(workspace.State.PendingActivations.Count!=0||fake.Done.Count(kvp=>kvp.Key==afterBad.Op&&kvp.Value.ActionId==a)!=1)throw new Exception("Retry after bad ack failed");
   if(fake.Root["notes"]!.AsArray().Count(n=>n!["path"]!.GetValue<string>().StartsWith("Writing/Untitled 2026-10-11"))!=2)throw new Exception("Bad ack attempt must not leave an orphan server file");

   // Second workspace: activation/delete/create lifecycle gates
   var d=Guid.NewGuid();var e=Guid.NewGuid();var f=Guid.NewGuid();
   var snapshot2=Json(new{notes=Array.Empty<object>(),quickActions=new[]{Action(d,"Delta","Writing","Untitled {date}.md"),Action(e,"Epsilon","Writing","Note {time}.md"),Action(f,"Zeta","Journal","Page {date}")}});
   var lifecycleRoot=Path.Combine(root,"lifecycle");Directory.CreateDirectory(lifecycleRoot);
   var store2=new NativeWorkspaceStore(lifecycleRoot);await store2.SaveAsync(SyncWorkspace.Empty.Receive(snapshot2));
   var gated=await NativeWorkspace.OpenAsync(store2);var server=new QuickFake(snapshot2);
   var opD=Guid.NewGuid();
   await gated.QueueQuickActionActivationAsync(d,opD);
   await ExpectAsync<InvalidOperationException>(()=>gated.DeleteLibraryAsync("quickActions",d.ToString()),"pending file activation");
   await gated.SyncAsync(server);
   if(gated.State.PendingActivations.Count!=0||!gated.State.VisibleFiles().Any(x=>x.Path=="Writing/Untitled 2026-10-11.md"))throw new Exception("Gated activation did not complete");
   await gated.DeleteLibraryAsync("quickActions",d.ToString());
   await ExpectAsync<InvalidOperationException>(()=>gated.QueueQuickActionOrderAsync([f.ToString(),e.ToString()]),"additions or removals");
   await gated.SyncAsync(server);
   if(!Order(gated.State).SequenceEqual([e.ToString(),f.ToString()]))throw new Exception("Quick action delete did not drain");
   await ExpectAsync<ArgumentException>(()=>gated.QueueQuickActionActivationAsync(d,Guid.NewGuid()),"Quick action not found");

   // Server-side revision change conflicts a queued deletion; catch-up deletes cleanly
   server.BumpRevision(e.ToString());
   await gated.DeleteLibraryAsync("quickActions",e.ToString());
   await gated.SyncAsync(server);
   var deleteConflict=gated.State.MetadataConflicts.SingleOrDefault();
   if(deleteConflict is null||deleteConflict.Operation.Kind!="delete"||deleteConflict.Reason!="Quick action changed before deletion.")throw new Exception("Delete conflict not recorded");
   await gated.ResolveLibraryAsync(deleteConflict.Operation.Id,false);
   if(!Order(gated.State).SequenceEqual([e.ToString(),f.ToString()]))throw new Exception("Discarded delete conflict removed the action");
   await gated.DeleteLibraryAsync("quickActions",e.ToString());
   await gated.SyncAsync(server);
   if(gated.State.MetadataConflicts.Count!=0||!Order(gated.State).SequenceEqual([f.ToString()]))throw new Exception("Delete after revision catch-up failed");

   // Pending creation blocks reorder; creation drains through the real lifecycle
   var g=Guid.NewGuid();
   await gated.CreateLibraryAsync("quickActions",Json(new{id=g.ToString(),label="New",folder="Writing",namePattern="Fresh {date}.md",templateId=(string?)null,revision=1,created="2026-10-11T00:00:00Z"}));
   await ExpectAsync<InvalidOperationException>(()=>gated.QueueQuickActionOrderAsync([f.ToString(),g.ToString()]),"additions or removals");
   await gated.SyncAsync(server);
   if(!Order(gated.State).SequenceEqual([f.ToString(),g.ToString()]))throw new Exception("Quick action creation did not drain");
   var h=Guid.NewGuid();
   await gated.CreateLibraryAsync("quickActions",Json(new{id=h.ToString(),label="Eta",folder="Writing",namePattern="Second {date}.md",templateId=(string?)null,revision=1,created="2026-10-11T00:00:00Z"}));
   await gated.SyncAsync(server);
   if(!Order(gated.State).SequenceEqual([f.ToString(),g.ToString(),h.ToString()]))throw new Exception("Second creation did not drain");

   // An unresolved order conflict retains a pending activation; resolution completes it
   var opF=Guid.NewGuid();
   await gated.QueueQuickActionActivationAsync(f,opF);
   await gated.QueueQuickActionOrderAsync([h.ToString(),g.ToString(),f.ToString()]);
   server.SetOrder(g.ToString(),h.ToString(),f.ToString());
   await gated.SyncAsync(server);
   if(gated.State.PendingActivations.Count!=1||gated.State.PendingActivations[0].Op!=opF)throw new Exception("Pending activation was not retained behind the order conflict");
   var orderConflict2=gated.State.MetadataConflicts.SingleOrDefault();
   if(orderConflict2 is null||orderConflict2.Operation.Kind!="order")throw new Exception("Order conflict not recorded");
   await gated.ResolveLibraryAsync(orderConflict2.Operation.Id,false);
   await gated.SyncAsync(server);
   if(gated.State.PendingActivations.Count!=0||!gated.State.VisibleFiles().Any(x=>x.Path=="Journal/Page 2026-10-11.md"))throw new Exception("Retained activation did not complete after resolution");
   if(!gated.State.ActivationLedger.Any(l=>l.ActionId==f&&l.Op==opF))throw new Exception("Retained activation missing from the ledger");
   if(gated.State.MetadataConflicts.Count!=0)throw new Exception("Lifecycle workspace left with conflicts");

   Console.WriteLine("PASS: quick action order durability with explicit conflicts, lost replies and corrupted acks, activation op replay with deterministic rejections, delete/create lifecycle gates with retained activations");
  }
  finally{Directory.Delete(root,true);}
 }
 sealed class QuickFake(JsonElement snapshot):ISyncTransport,IQuickActionTransport,IStyleTransport,IMetadataSyncTransport
 {
  public JsonObject Root=JsonNode.Parse(snapshot.GetRawText())!.AsObject();
  public DateTime Now=new(2026,10,11,12,0,0);
  public List<Guid> Ops=[];
  public Dictionary<Guid,(Guid ActionId,Guid NoteId)> Done=new();
  public int Orders;public int Puts;public int Activations;
  public bool FailActivation;public bool LoseActivationReply;public bool LoseOrderReply;public bool BrokenOrderAck;public bool BadActivationAck;
  public (string[] Ids,string[] Expected)? LastOrder;
  static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(Json(new{owner="owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement m,CancellationToken c)=>throw new Exception("No file edits expected");
  public Task<JsonElement> PutStyleAsync(string path,string content,CancellationToken c)
  {
   Puts++;
   if(Root["styles"] is null)Root["styles"]=new JsonObject();
   Root["styles"]!.AsObject()[path]=content;
   return Task.FromResult(Json(new{path,content}));
  }
  public void SetOrder(params string[] ids)
  {
   var array=Root["quickActions"]!.AsArray();
   var byId=array.ToDictionary(x=>x!["id"]!.GetValue<string>(),x=>x!.DeepClone());
   array.Clear();foreach(var id in ids)array.Add(byId[id].DeepClone());
  }
  public void SetTemplate(string id,string? templateId)
  {
   var node=Root["quickActions"]!.AsArray().Single(x=>x!["id"]!.GetValue<string>()==id)!.AsObject();
   if(templateId is null)node.Remove("templateId");else node["templateId"]=templateId;
  }
  public void BumpRevision(string id)
  {
   var node=Root["quickActions"]!.AsArray().Single(x=>x!["id"]!.GetValue<string>()==id)!.AsObject();
   node["revision"]=node["revision"]!.GetValue<int>()+1;
  }
  public void RemoveNote(Guid noteId)
  {
   var notes=Root["notes"]!.AsArray();
   for(var i=notes.Count-1;i>=0;i--)if(notes[i]!["id"]!.GetValue<string>()==noteId.ToString())notes.RemoveAt(i);
  }
  public Task<(bool Conflict,JsonElement Result)> ReorderQuickActionsAsync(string[] ids,string[] expected,CancellationToken c)
  {
   LastOrder=(ids,expected);
   var array=Root["quickActions"]!.AsArray();
   var current=array.Select(x=>x!["id"]!.GetValue<string>()).ToArray();
   if(!current.SequenceEqual(expected))return Task.FromResult((true,Json(new{error="Action order changed elsewhere"})));
   if(ids.Length!=current.Length||!ids.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(current.OrderBy(x=>x,StringComparer.Ordinal)))return Task.FromResult((true,Json(new{error="Include every action exactly once"})));
   if(BrokenOrderAck){BrokenOrderAck=false;return Task.FromResult((false,Json(new{ok=false})));}
   Orders++;SetOrder(ids);
   if(LoseOrderReply){LoseOrderReply=false;throw new IOException("lost order reply");}
   return Task.FromResult((false,Json(new{ok=true})));
  }
  public Task<JsonElement> ActivateQuickActionAsync(Guid actionId,Guid op,CancellationToken c)
  {
   Activations++;Ops.Add(op);
   if(Done.TryGetValue(op,out var done))
   {
    if(done.ActionId!=actionId)throw new InvalidOperationException("Operation ID already used for another quick action.");
    var existing=Root["notes"]!.AsArray().FirstOrDefault(n=>n!["id"]!.GetValue<string>()==done.NoteId.ToString())??throw new InvalidOperationException("Created file is no longer available.");
    return Task.FromResult(JsonSerializer.SerializeToElement(existing));
   }
   if(FailActivation){FailActivation=false;throw new IOException("disconnected during activation");}
   var action=Root["quickActions"]!.AsArray().FirstOrDefault(x=>x!["id"]!.GetValue<string>()==actionId.ToString())??throw new InvalidOperationException("Quick action not found.");
   var templateId=action["templateId"]?.GetValue<string>();
   if(templateId is not null&&!QuickActionRules.TemplateAvailable(templateId,[]))throw new InvalidOperationException("The configured template is unavailable. Edit this action in Settings.");
   var folder=action["folder"]!.GetValue<string>();
   var path=folder+"/"+QuickActionRules.Stem(action["namePattern"]!.GetValue<string>(),Now)+".md";
   var notes=Root["notes"]!.AsArray();
   var candidate=path;var suffix=1;
   while(notes.Any(n=>n!["path"]!.GetValue<string>().Equals(candidate,StringComparison.OrdinalIgnoreCase))){suffix++;candidate=path[..^3]+"-"+suffix+".md";}
   var noteId=Guid.NewGuid();
   var note=new JsonObject{["id"]=noteId.ToString(),["rev"]=1,["path"]=candidate,["content"]=templateId is null?"":"# "+templateId,["deleted"]=false,["time"]="2026-10-11T12:00:00Z",["history"]=new JsonArray()};
   if(BadActivationAck){BadActivationAck=false;return Task.FromResult(Json(new{id=noteId.ToString(),rev=0,path=candidate,content="",deleted=false,time="2026-10-11T12:00:00Z",history=Array.Empty<object>()}));}
   notes.Add(note);Done[op]=(actionId,noteId);
   if(LoseActivationReply){LoseActivationReply=false;throw new IOException("lost activation reply");}
   return Task.FromResult(JsonSerializer.SerializeToElement(note));
  }
  public Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation m,CancellationToken c)
  {
   var array=Root["quickActions"]!.AsArray();
   if(m.Kind=="delete")
   {
    for(var i=array.Count-1;i>=0;i--)if(array[i]!["id"]!.GetValue<string>()==m.RecordId)array.RemoveAt(i);
    return Task.FromResult((false,Json(new{ok=true})));
   }
   if(m.Kind=="create")
   {
    var record=JsonNode.Parse(m.Value.GetRawText())!.AsObject();
    record["id"]=m.RecordId;
    if(record["revision"] is null)record["revision"]=1;
    if(record["created"] is null)record["created"]="2026-10-11T00:00:00Z";
    array.Add(record);
    return Task.FromResult((false,JsonSerializer.SerializeToElement(record)));
   }
   throw new Exception("Unexpected metadata kind "+m.Kind);
  }
 }
}
