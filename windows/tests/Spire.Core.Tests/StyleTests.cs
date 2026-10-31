using Spire.Core;
using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Nodes;
// Hosted parity regression coverage for style-css.ts validation, the native style projection,
// durable style outboxes with rename guards, idempotent style synchronization, and safe
// full-state archives that round-trip quick action and stylesheet state.
static class StyleTests
{
 static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
 static void Throws<T>(Action action,string what) where T:Exception
 {
  try{action();}catch(T){return;}catch(Exception e){throw new Exception(what+" threw "+e.GetType().Name+": "+e.Message);}
  throw new Exception(what+" did not throw "+typeof(T).Name);
 }
 static async Task ExpectAsync<T>(Func<Task> action,string? contains=null) where T:Exception
 {
  try{await action();}
  catch(T e){if(contains is not null&&!e.Message.Contains(contains,StringComparison.Ordinal))throw new Exception("Wrong failure message: "+e.Message);return;}
  catch(Exception e){throw new Exception("Unexpected "+e.GetType().Name+": "+e.Message);}
  throw new Exception("Expected "+typeof(T).Name);
 }
 public static async Task Run()
 {
  var root=Path.Combine(Path.GetTempPath(),"spire-style-tests-"+Guid.NewGuid());Directory.CreateDirectory(root);
  try
  {
   var css="h1{color:red}.note{background-color:#111}";
   var snapshot=Json(new{notes=Array.Empty<object>(),styles=new Dictionary<string,string>{{"Writing/A.css",css}}});

   // Empty workspace
   var store=new NativeWorkspaceStore(root);await store.SaveAsync(SyncWorkspace.Empty);
   var workspace=await NativeWorkspace.OpenAsync(store);
   if(workspace.State.Styles().Count!=0||workspace.State.Style("Writing/A.css") is not null)throw new Exception("Empty workspace must expose no styles");

   // Server snapshot styles are visible and validated
   await store.SaveAsync(SyncWorkspace.Empty.Receive(snapshot));
   workspace=await NativeWorkspace.OpenAsync(store);
   if(workspace.State.Style("Writing/A.css")!=css||workspace.State.Style("writing/a.css")!=css)throw new Exception("Snapshot styles not visible");
   foreach(var bad in new[]{
    Json(new{notes=Array.Empty<object>(),styles=new[]{"not-a-map"}}),
    Json(new{notes=Array.Empty<object>(),styles=new Dictionary<string,string>{{"Writing/A.txt",css}}}),
    Json(new{notes=Array.Empty<object>(),styles=new Dictionary<string,string>{{"Writing/A.css",new string('x',100_001)}}}),
    Json(new{notes=Array.Empty<object>(),styles=new Dictionary<string,object?>{{"Writing/A.css",5}}}),
    Json(new{notes=Array.Empty<object>(),styles=new Dictionary<string,string>{{"../Escape.css",css}}})})
   {bool failed=false;try{SyncWorkspace.Empty.Receive(bad);}catch(InvalidDataException){failed=true;}if(!failed)throw new Exception("Unsafe server stylesheet accepted");}

   // Queue a style edit: validated, durable, overlays the snapshot, replaces the same path
   await workspace.QueueStyleAsync("Writing/A.css","h1{color:blue}");
   if(workspace.State.StyleOutbox.Count!=1||workspace.State.Style("Writing/A.css")!="h1{color:blue}")throw new Exception("Queued style not overlaid");
   await workspace.QueueStyleAsync("Writing/A.css","h1{color:green}");
   if(workspace.State.StyleOutbox.Count!=1||workspace.State.Style("Writing/A.css")!="h1{color:green}")throw new Exception("Duplicate style path must replace");
   workspace=await NativeWorkspace.OpenAsync(store);
   if(workspace.State.StyleOutbox.Count!=1||workspace.State.Style("Writing/A.css")!="h1{color:green}")throw new Exception("Style outbox not durable");
   foreach(var (path,content) in new[]{
    ("Writing/A.txt","h1{color:red}"),("../Escape.css","h1{color:red}"),("Writing/A.css","@import url(x)"),
    ("Writing/A.css","a{background:url(x.png)}"),("Writing/A.css","@font-face{font-family:x}"),("Writing/A.css","@page{margin:0}"),
    ("Writing/A.css","a{color:red} html{color:red}"),("Writing/A.css","html{color:red}"),("Writing/A.css","body{color:red}"),("Writing/A.css","body h1{color:red}"),
    ("Writing/A.css","h1,,p{color:red}"),("Writing/A.css",new string('x',100_001))})
   {
    try{await workspace.QueueStyleAsync(path,content);}catch(ArgumentException){if(workspace.State.StyleOutbox.Count!=1)throw new Exception("Rejected style changed the outbox: "+path);continue;}
    throw new Exception("Unsafe style accepted: "+path+" / "+content);
   }
   if(workspace.State.Style("Writing/A.css")!="h1{color:green}")throw new Exception("Rejected styles changed the overlay");
   // Hosted-faithful quirks (client/style-css.ts): the head regex (^|})(\s*)([^@{}][^{}]*)\{ never
   // matches a standalone ":root" selector (\b cannot occur before ":"), an empty "{}" block, or
   // "@"-prefixed at-rule preambles, so native accepts them exactly like the hosted scoper.
   QuickActionRules.ValidateStyle("Writing/Quirk.css",":root{color:red}");
   QuickActionRules.ValidateStyle("Writing/Quirk.css","{}");
   QuickActionRules.ValidateStyle("Writing/Quirk.css","@media print{h1{color:red}}");

   // ParseRules: native projection subset
   if(QuickActionRules.ParseRules("@media print{h1{color:red}}").Count!=0)throw new Exception("Nested media bodies must be skipped");
   var rules=QuickActionRules.ParseRules("H1{ COLOR : red ; font-size :12px } .note{background-color:#111} p.note{text-align:center} a:hover{color:red} div > p{margin:0} a[href]{color:blue} html{color:red} {}");
   if(rules.Count!=3)throw new Exception("ParseRules count "+rules.Count);
   if(rules[0].Tag!="h1"||rules[0].Class is not null||rules[0].Declarations["color"]!="red"||rules[0].Declarations["font-size"]!="12px")throw new Exception("Tag rule projection");
   if(rules[1].Tag!=""||rules[1].Class!="note"||rules[1].Declarations["background-color"]!="#111")throw new Exception("Class rule projection");
   if(rules[2].Tag!="p"||rules[2].Class!="note"||rules[2].Declarations["text-align"]!="center")throw new Exception("Tag.class rule projection");
   var h1Rule=QuickActionRules.ParseRules("h1{color:red}").SingleOrDefault();
   if(h1Rule is null||h1Rule.Declarations["COLOR"]!="red")throw new Exception("Declaration lookup must be case-insensitive");
   var shared=QuickActionRules.ParseRules("h1,p{COLOR:red;color:blue}");
   if(shared.Count!=2||shared[0].Declarations["color"]!="blue"||shared[1].Declarations["color"]!="blue")throw new Exception("Comma selectors must share deduped declarations");
   if(QuickActionRules.ParseRules("@import url(x);h1{color:red}").Count!=0)throw new Exception("Forbidden content must produce no rules");

   // Style sync through a real transport: idempotent PUT, lost reply, bad ack, missing transport
   var remote=new StyleFake(workspace.State.Snapshot!.Value);
   await workspace.SyncAsync(remote);
   if(remote.Puts!=1||workspace.State.StyleOutbox.Count!=0||remote.Root["styles"]!["Writing/A.css"]!.GetValue<string>()!="h1{color:green}")throw new Exception("Style PUT flow");
   if(workspace.State.Style("Writing/A.css")!="h1{color:green}")throw new Exception("Acknowledged style not visible from the snapshot");
   await workspace.QueueStyleAsync("Writing/A.css","h1{color:black}");
   remote.LoseReply=true;
   await ExpectAsync<IOException>(()=>workspace.SyncAsync(remote));
   if(workspace.State.StyleOutbox.Count!=1||remote.Puts!=2)throw new Exception("Lost style reply must retain the edit");
   await workspace.SyncAsync(remote);
   if(remote.Puts!=3||workspace.State.StyleOutbox.Count!=0||remote.Root["styles"]!["Writing/A.css"]!.GetValue<string>()!="h1{color:black}")throw new Exception("Style retry was not idempotent");
   await workspace.QueueStyleAsync("Writing/B.css","p{margin:0}");
   remote.BadAck=true;
   await ExpectAsync<InvalidDataException>(()=>workspace.SyncAsync(remote),"acknowledgement");
   if(workspace.State.StyleOutbox.Count!=1)throw new Exception("Bad style ack must retain the edit");
   remote.BadAck=false;await workspace.SyncAsync(remote);
   if(workspace.State.StyleOutbox.Count!=0||remote.Root["styles"]!["Writing/B.css"]!.GetValue<string>()!="p{margin:0}")throw new Exception("Style retry after bad ack failed");
   await workspace.QueueStyleAsync("Writing/C.css","p{padding:1px}");
   await ExpectAsync<InvalidOperationException>(()=>workspace.SyncAsync(new MinimalFake(workspace.State.Snapshot!.Value)),"cannot synchronize styles");
   if(workspace.State.StyleOutbox.Count!=1)throw new Exception("Style edit must be retained without a style transport");

   // Fail closed: pending and conflicted renames own both stylesheet paths
   var noteId=Guid.NewGuid();var history=JsonSerializer.SerializeToElement(Array.Empty<object>());
   var fileSnapshot=Json(new{notes=new object[]{new{id=noteId.ToString(),rev=1,path="Writing/A.md",content="# A",deleted=false,time="2026-01-01T00:00:00Z",history=Array.Empty<object>()}},styles=new Dictionary<string,string>{{"Writing/A.css",css}}});
   var state=SyncWorkspace.Empty.Receive(fileSnapshot);
   var renamed=state.Queue(new ServerFile(noteId,1,"Writing/B.md","# A",false,"2026-01-01T00:00:00Z",history));
   if(renamed.Outbox.Count!=1)throw new Exception("Rename not queued");
   Throws<InvalidOperationException>(()=>renamed.QueueStyle("Writing/A.css","h1{color:red}"),"old stylesheet path");
   Throws<InvalidOperationException>(()=>renamed.QueueStyle("Writing/B.css","h1{color:red}"),"new stylesheet path");
   renamed=renamed.QueueStyle("Writing/C.css","h1{color:red}");
   if(renamed.StyleOutbox.Count!=1)throw new Exception("Uninvolved stylesheet must remain editable");
   var styled=state.QueueStyle("Writing/A.css","h1{color:blue}");
   Throws<InvalidOperationException>(()=>styled.Queue(new ServerFile(noteId,1,"Writing/B.md","# A",false,"2026-01-01T00:00:00Z",history)),"pending style must block the rename");
   styled=styled.Queue(new ServerFile(noteId,1,"Writing/A.md","# A2",false,"2026-01-01T00:00:00Z",history));
   if(styled.Outbox.Count!=1)throw new Exception("Same-path edit must be allowed");
   var mutation=Json(new{op=Guid.NewGuid().ToString(),id=noteId.ToString(),@base=1,path="Writing/B.md",content="# A",deleted=false});
   var conflict=new JsonObject{["id"]=Guid.NewGuid().ToString(),["current"]=1,["mutation"]=JsonNode.Parse(mutation.GetRawText())};
   var conflicted=state with{Conflicts=[JsonSerializer.SerializeToElement(conflict)]};
   Throws<InvalidOperationException>(()=>conflicted.QueueStyle("Writing/A.css","h1{color:red}"),"conflicted old stylesheet path");
   Throws<InvalidOperationException>(()=>conflicted.QueueStyle("Writing/B.css","h1{color:red}"),"conflicted new stylesheet path");
   if(conflicted.StyleOutbox.Count!=0)throw new Exception("Conflicted rename must not queue styles");

   // Native store fail-closed validation of quick action and style state
   var qa1=Guid.NewGuid();var qa2=Guid.NewGuid();
   var isolatedRoot=Path.Combine(root,"store");Directory.CreateDirectory(isolatedRoot);
   var isolated=new NativeWorkspaceStore(isolatedRoot);
   var good=SyncWorkspace.Empty.Receive(fileSnapshot);
   await isolated.SaveAsync(good with{QuickActionOrder=new(Guid.NewGuid(),[qa2.ToString(),qa1.ToString()],[qa1.ToString(),qa2.ToString()])});
   _=await isolated.LoadAsync();
   await isolated.SaveAsync(good with{PendingActivations=[new(qa1,Guid.NewGuid()),new(qa1,Guid.NewGuid())]});
   await ExpectAsync<InvalidDataException>(()=>isolated.LoadAsync(),"Corrupt pending activation");
   await isolated.SaveAsync(good with{PendingActivations=[new(qa1,Guid.Empty)]});
   await ExpectAsync<InvalidDataException>(()=>isolated.LoadAsync(),"Corrupt pending activation");
   await isolated.SaveAsync(good with{QuickActionOrder=new(Guid.NewGuid(),["not-a-guid"],[qa1.ToString()])});
   await ExpectAsync<InvalidDataException>(()=>isolated.LoadAsync(),"Corrupt quick action order");
   // Duplicate order ids are an archive-level import rejection (Distinct check); the native store
   // only requires parseable identities because SaveAsync is app-controlled and queueing is distinct.
   await isolated.SaveAsync(good with{StyleOutbox=[new StyleEdit("Writing/A.css","@import url(x)")]});
   await ExpectAsync<ArgumentException>(()=>isolated.LoadAsync());
   await isolated.SaveAsync(good with{StyleOutbox=[new StyleEdit("Writing/A.css","h1{color:red}")]});
   _=await isolated.LoadAsync();

   // Archive: full-state round trip including quick action and stylesheet state
   var archiveSnapshot=Json(new{notes=new object[]{new{id=noteId.ToString(),rev=1,path="Writing/A.md",content="# A",deleted=false,time="2026-01-01T00:00:00Z",history=Array.Empty<object>()}},styles=new Dictionary<string,string>{{"Writing/A.css",css}},quickActions=new object[]{new{id=qa1.ToString(),label="One",folder="Writing",namePattern="A {date}.md",templateId=(string?)null,revision=1,created="2026-01-01T00:00:00Z"},new{id=qa2.ToString(),label="Two",folder="Writing",namePattern="B {date}.md",templateId=(string?)null,revision=1,created="2026-01-01T00:00:00Z"}}});
   var archived=SyncWorkspace.Empty.Receive(archiveSnapshot).BindOwner("owner") with{
    QuickActionOrder=new(Guid.NewGuid(),[qa2.ToString(),qa1.ToString()],[qa1.ToString(),qa2.ToString()]),
    PendingActivations=[new(qa1,Guid.NewGuid())],
    ActivationLedger=[new(qa2,Guid.NewGuid(),Guid.NewGuid(),"Writing/Ledger.md")],
    StyleOutbox=[new StyleEdit("Writing/Pending.css","h1{color:red}")]};
   var archivePath=Path.Combine(root,"backup.spirebackup");
   await WorkspaceArchive.ExportAsync(archivePath,archived);
   var restored=await WorkspaceArchive.ReadAsync(archivePath);
   if(JsonSerializer.SerializeToElement(restored,SyncWorkspace.Json).GetRawText()!=JsonSerializer.SerializeToElement(archived,SyncWorkspace.Json).GetRawText())throw new Exception("Archive round trip lost state");
   await workspace.RestoreBackupAsync(archivePath);
   if(workspace.State.QuickActionOrder is null||workspace.State.StyleOutbox.Count!=1||workspace.State.PendingActivations.Count!=1||workspace.State.ActivationLedger.Count!=1||workspace.State.Owner!="owner")throw new Exception("Restore did not adopt the archived state");
   var foreign=Path.Combine(root,"foreign.spirebackup");
   await WorkspaceArchive.ExportAsync(foreign,SyncWorkspace.Empty.BindOwner("other"));
   await ExpectAsync<InvalidOperationException>(()=>workspace.RestoreBackupAsync(foreign),"different account");
   if(workspace.State.QuickActionOrder is null)throw new Exception("Foreign restore must not replace the workspace");

   async Task Reject(SyncWorkspace bad,string what)
   {
    var path=Path.Combine(root,"reject-"+what+".spirebackup");
    await WorkspaceArchive.ExportAsync(path,bad);
    try{await WorkspaceArchive.ReadAsync(path);}
    catch(Exception e)when(e is InvalidDataException or ArgumentException){return;}
    throw new Exception("Corrupt archive accepted: "+what);
   }
   var baseState=SyncWorkspace.Empty.Receive(archiveSnapshot).BindOwner("owner");
   await Reject(baseState with{StyleOutbox=[new StyleEdit("Writing/A.css","h1{color:red}"),new StyleEdit("writing/a.css","h1{color:red}")]},"duplicate-stylesheet-edit");
   await Reject(baseState with{StyleOutbox=[new StyleEdit("Writing/A.css","@import url(x)")]},   "unsafe-stylesheet-edit");
   await Reject(baseState with{StyleOutbox=[new StyleEdit("../Escape.css","h1{color:red}")]},    "unportable-stylesheet-path");
   await Reject(baseState with{PendingActivations=[new(qa1,Guid.NewGuid()),new(qa1,Guid.NewGuid())]},"duplicate-pending-activation");
   await Reject(baseState with{PendingActivations=[new(qa1,Guid.Empty)]},                        "empty-activation-identity");
   await Reject(baseState with{QuickActionOrder=new(Guid.NewGuid(),["not-a-guid"],[qa1.ToString()])},"invalid-order-id");
   await Reject(baseState with{QuickActionOrder=new(Guid.NewGuid(),[qa1.ToString(),qa1.ToString()],[qa1.ToString(),qa2.ToString()])},"duplicate-order-ids");
   await Reject(baseState with{QuickActionOrder=new(Guid.Empty,[qa1.ToString()],[qa2.ToString()])},"empty-order-op");
   await Reject(baseState with{ActivationLedger=[new(qa1,Guid.NewGuid(),Guid.Empty,"Writing/X.md")]},"ledger-identity");
   var versioned=Path.Combine(root,"versioned.spirebackup");
   using(var write=new FileStream(versioned,FileMode.Create))
   using(var zip=new ZipArchive(write,ZipArchiveMode.Create))
   {
    var entry=zip.CreateEntry("workspace.json");
    using var output=entry.Open();
    JsonSerializer.Serialize(output,new{schema=2,workspace=baseState},SyncWorkspace.Json);
   }
   await ExpectAsync<InvalidDataException>(()=>WorkspaceArchive.ReadAsync(versioned),"Unsupported backup version");

   Console.WriteLine("PASS: style validation and native projection rules, durable style outbox with bidirectional rename guards, idempotent style sync with lost replies and bad acks, native store fail-closed state, archive round trip and corrupt-backup rejection");
  }
  finally{Directory.Delete(root,true);}
 }
 sealed class StyleFake(JsonElement snapshot):ISyncTransport,IStyleTransport
 {
  public JsonObject Root=JsonNode.Parse(snapshot.GetRawText())!.AsObject();
  public int Puts;public bool LoseReply;public bool BadAck;
  static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(Json(new{owner="owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement m,CancellationToken c)=>throw new Exception("No file edits expected");
  public Task<JsonElement> PutStyleAsync(string path,string content,CancellationToken c)
  {
   Puts++;
   if(Root["styles"] is null)Root["styles"]=new JsonObject();
   Root["styles"]!.AsObject()[path]=content;
   if(LoseReply){LoseReply=false;throw new IOException("lost style reply");}
   return Task.FromResult(Json(new{path,content=BadAck?"wrong":content}));
  }
 }
 sealed class MinimalFake(JsonElement snapshot):ISyncTransport
 {
  public JsonObject Root=JsonNode.Parse(snapshot.GetRawText())!.AsObject();
  public Task<JsonElement> IdentityAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(new{owner="owner"}));
  public Task<JsonElement> SnapshotAsync(CancellationToken c)=>Task.FromResult(JsonSerializer.SerializeToElement(Root));
  public Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement m,CancellationToken c)=>throw new Exception("No file edits expected");
 }
}
