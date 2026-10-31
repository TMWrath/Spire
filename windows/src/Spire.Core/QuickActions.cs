using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace Spire.Core;

public sealed record QuickActionOrder(Guid Op,string[] Ids,string[] Expected);
public sealed record QuickActionActivation(Guid ActionId,Guid Op);
public sealed record QuickActionActivationRecord(Guid ActionId,Guid Op,Guid NoteId,string Path);
public sealed record StyleEdit(string Path,string Content);
public sealed record StyleRule(string Tag,string? Class,IReadOnlyDictionary<string,string> Declarations);

public interface IQuickActionTransport
{
 Task<JsonElement> ActivateQuickActionAsync(Guid actionId,Guid op,CancellationToken cancellation);
 Task<(bool Conflict,JsonElement Result)> ReorderQuickActionsAsync(string[] ids,string[] expected,CancellationToken cancellation);
}
public interface IStyleTransport
{
 Task<JsonElement> PutStyleAsync(string path,string content,CancellationToken cancellation);
}

// Hosted parity: shared/quick-actions.ts quickActionInputSchema, server/store.ts quick action endpoints,
// and client QuickActions.tsx activation flow (same op id per action until it succeeds).
public static partial class QuickActionRules
{
 static readonly Regex ForbiddenFetch=new(@"@import\b|url\s*\(",RegexOptions.IgnoreCase|RegexOptions.Compiled);
 static readonly Regex ForbiddenAtRule=new(@"@(?:namespace|charset|supports|layer|container|document|page|font-face|keyframes)\b",RegexOptions.IgnoreCase|RegexOptions.Compiled);
 static readonly Regex ClientRootTarget=new(@"\b(?:html|body|:root)\b",RegexOptions.IgnoreCase|RegexOptions.Compiled);
 // Hosted scoping parity (client/style-css.ts): only the rule head through "{" is matched, so the
 // body and closing brace stay unconsumed and every head following a rule is still seen. Heads whose
 // first character is "@" or "{" (at-rule preambles, empty blocks) are never treated as selectors.
 static readonly Regex RuleHead=new(@"(^|})(\s*)([^@{}][^{}]*)\{",RegexOptions.Compiled);
 static readonly Regex TagClass=new(@"^([a-zA-Z][a-zA-Z0-9-]*)?((?:\.[A-Za-z_][\w-]*)+)?$",RegexOptions.Compiled);

 public static string StylePath(string notePath)
 {
  if(!notePath.EndsWith(".md",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Notes must end in .md.");
  return notePath[..^3]+".css";
 }
 public static string Substitute(string pattern,DateTime now)=>pattern
  .Replace("{date}",now.ToString("yyyy-MM-dd"))
  .Replace("{time}",now.ToString("HH-mm-ss"));
 // Hosted actionStem parity: {date}/{time} substitution, then the optional .md suffix is stripped
 // so the server target is exactly folder + "/" + stem + ".md".
 public static string Stem(string pattern,DateTime now)=>Regex.Replace(Substitute(pattern,now),"\\.md$",string.Empty,RegexOptions.IgnoreCase);
 public static void ValidateInput(string label,string folder,string namePattern,string? templateId,IReadOnlyList<JsonElement> templates)
 {
  if(label.Trim().Length is <1 or >100)throw new ArgumentException("Use an action label of 1 to 100 characters.");
  LocalFiles.ValidatePortablePath(folder);
  var pattern=namePattern.Trim();
  if(pattern.Length is <1 or >120)throw new ArgumentException("Use a filename pattern of 1 to 120 characters.");
  if(pattern.Contains('/'))throw new ArgumentException("The filename pattern cannot include slashes.");
  // Schema parity: the {date}/{time}-substituted pattern must be a valid portable path.
  var substituted=Substitute(pattern,new DateTime(2026,1,1,12,0,0));
  LocalFiles.ValidatePortablePath(substituted);
  if(Regex.Replace(substituted,"\\.md$","",RegexOptions.IgnoreCase).Length==0)throw new ArgumentException("The filename needs a name besides the extension.");
  // Server parity: the full target path is validated with the current date at save time.
  LocalFiles.ValidatePortablePath(folder+"/"+Stem(pattern,DateTime.Now)+".md");
  if(templateId is not null)
  {
   if(templateId.Length>100)throw new ArgumentException("Invalid template choice.");
   if(!TemplateAvailable(templateId,templates))throw new ArgumentException("The configured template is unavailable. Edit this action in Settings.");
  }
 }
 public static bool TemplateAvailable(string templateId,IReadOnlyList<JsonElement> templates)
 {
  if(templateId.StartsWith("saved-",StringComparison.Ordinal))
  {
   var id=templateId["saved-".Length..];
   return templates.Any(t=>t.TryGetProperty("id",out var value)&&value.GetString()==id);
  }
  return NativeTemplates.FullIds.Contains(templateId);
 }
 public static JsonElement Normalize(JsonElement value,JsonElement original,IReadOnlyList<JsonElement> templates)
 {
  if(value.ValueKind!=JsonValueKind.Object||!value.TryGetProperty("id",out var identity)||identity.GetString()!=original.GetProperty("id").GetString())throw new ArgumentException("Invalid library record identity.");
  var root=JsonNode.Parse(original.GetRawText())!.AsObject();
  foreach(var field in value.EnumerateObject())
  {
   if(LibraryRules.Fields("quickActions").ContainsKey(field.Name))continue;
   if(!original.TryGetProperty(field.Name,out var before)||!JsonElement.DeepEquals(before,field.Value))throw new ArgumentException("Read-only or unknown metadata fields cannot be changed.");
  }
  string Require(string key)
  {
   if(!value.TryGetProperty(key,out var raw)||raw.ValueKind!=JsonValueKind.String)throw new ArgumentException("Library field must be text: "+key);
   return raw.GetString()!;
  }
  if(!value.TryGetProperty("templateId",out var template)||template.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))throw new ArgumentException("Library field must be text: templateId");
  var templateId=template.ValueKind==JsonValueKind.String?template.GetString():null;
  var label=Require("label");var folder=Require("folder");var namePattern=Require("namePattern");
  ValidateInput(label,folder,namePattern,templateId,templates);
  root["label"]=label.Trim();root["folder"]=folder;root["namePattern"]=namePattern.Trim();root["templateId"]=templateId;
  if(!original.TryGetProperty("revision",out var revision)||revision.ValueKind!=JsonValueKind.Number||revision.GetInt32()<1)throw new ArgumentException("Missing quick action revision.");
  return JsonSerializer.SerializeToElement(root,SyncWorkspace.Json);
 }
 public static JsonElement OrderPayload(QuickActionOrder order)=>JsonSerializer.SerializeToElement(new{ids=order.Ids,expected=order.Expected},SyncWorkspace.Json);
 public static void ValidateStyle(string path,string content)
 {
  LocalFiles.ValidatePortablePath(path);
  if(!path.EndsWith(".css",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Stylesheets must end in .css.");
  if(content.Length>100_000)throw new ArgumentException("Stylesheet exceeds 100 KB.");
  if(ForbiddenFetch.IsMatch(content))throw new ArgumentException("CSS imports and URLs are not allowed.");
  if(ForbiddenAtRule.IsMatch(content))throw new ArgumentException("This CSS at-rule is not allowed.");
  // Client parity (style-css.ts): nonempty selectors that cannot target the application root.
  foreach(Match rule in RuleHead.Matches(content))
  {
   foreach(var selector in rule.Groups[3].Value.Split(','))
   {
    var clean=selector.Trim();
    if(clean.Length==0)throw new ArgumentException("CSS contains an empty selector.");
    if(ClientRootTarget.IsMatch(clean))throw new ArgumentException("CSS selectors cannot target the application root.");
   }
  }
 }
 public static bool StyleAllowed(string content)=>!ForbiddenFetch.IsMatch(content)&&!ForbiddenAtRule.IsMatch(content);
 // Native projection parser: extracts tag / .class / tag.class rules with their declarations.
 // Selectors outside this deliberate subset (pseudo-classes, combinators, attribute selectors) are
 // parsed by the browser in the hosted app but have no native counterpart and are skipped.
 public static IReadOnlyList<StyleRule> ParseRules(string css)
 {
  if(!StyleAllowed(css))return[];
  var rules=new List<StyleRule>();
  foreach(Match match in RuleHead.Matches(css))
  {
   var declarations=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   // The head match stops at "{" (hosted parity); the body runs to the next closing brace.
   var bodyStart=match.Index+match.Length;
   var bodyEnd=css.IndexOf('}',bodyStart);
   foreach(var declaration in (bodyEnd<0?"":css[bodyStart..bodyEnd]).Split(';',StringSplitOptions.RemoveEmptyEntries))
   {
    var index=declaration.IndexOf(':');if(index<1)continue;
    var property=declaration[..index].Trim().ToLowerInvariant();var content=declaration[(index+1)..].Trim();
    if(property.Length>0&&content.Length>0)declarations[property]=content;
   }
   if(declarations.Count==0)continue;
   foreach(var selector in match.Groups[3].Value.Split(','))
   {
    var clean=selector.Trim();
    if(clean.Length==0||ClientRootTarget.IsMatch(clean))continue;
    var form=TagClass.Match(clean);
    if(!form.Success||form.Groups[1].Value.Length==0&&form.Groups[2].Value.Length==0)continue;
    rules.Add(new(form.Groups[1].Value.ToLowerInvariant(),form.Groups[2].Value.Length>0?form.Groups[2].Value.TrimStart('.'):null,declarations));
   }
  }
  return rules;
 }
}

public sealed partial record SyncWorkspace
{
 public QuickActionOrder? QuickActionOrder {get;init;}
 public IReadOnlyList<QuickActionActivation> PendingActivations {get;init;}=[];
 public IReadOnlyList<QuickActionActivationRecord> ActivationLedger {get;init;}=[];
 public IReadOnlyList<StyleEdit> StyleOutbox {get;init;}=[];
 public bool QuickActionWorkPending=>MetadataOutbox.Any(m=>m.Collection=="quickActions");
 public bool CleanForActivation()=>Outbox.Count==0&&Conflicts.Count==0&&MetadataOutbox.Count==0&&MetadataConflicts.Count==0&&FolderOutbox.Count==0&&FolderConflicts.Count==0&&StyleOutbox.Count==0&&QuickActionOrder is null;
 public Guid? PendingActivationOp(Guid actionId)=>PendingActivations.FirstOrDefault(p=>p.ActionId==actionId)?.Op;
 public SyncWorkspace QueueQuickActionActivation(Guid actionId,Guid op)
 {
  if(actionId==Guid.Empty||op==Guid.Empty)throw new ArgumentException("Invalid quick action activation identity.");
  if(PendingActivations.Any(p=>p.ActionId==actionId))throw new InvalidOperationException("This action already has a pending activation; synchronize to retry it with the same identity.");
  var actions=Library("quickActions");
  if(actions.All(r=>r.GetProperty("id").GetString()!=actionId.ToString()))throw new ArgumentException("Quick action not found.");
  return this with{PendingActivations=PendingActivations.Append(new(actionId,op)).ToArray()};
 }
 public SyncWorkspace CompleteActivation(QuickActionActivation activation,JsonElement note)
 {
  var file=note.Deserialize<ServerFile>(Json)??throw new InvalidDataException("Invalid activation acknowledgement; pending request retained.");
  if(file.Id==Guid.Empty||file.Rev<1||file.Content is null||file.Content.Length>1_000_000||file.Deleted||file.History.ValueKind!=JsonValueKind.Array)throw new InvalidDataException("Invalid activation acknowledgement; pending request retained.");
  LocalFiles.ValidatePath(file.Path);
  var next=ApplyAcknowledged(note) with{PendingActivations=PendingActivations.Where(p=>p.Op!=activation.Op).ToArray()};
  return next with{ActivationLedger=next.ActivationLedger.Where(l=>l.Op!=activation.Op).Append(new(activation.ActionId,activation.Op,file.Id,file.Path)).TakeLast(20).ToArray()};
 }
 public SyncWorkspace ActivationConflict(QuickActionActivation activation,string reason)
 {
  var operation=new LibraryMutation(Guid.NewGuid(),"quickActions",activation.ActionId.ToString(),JsonSerializer.SerializeToElement((object?)null),JsonSerializer.SerializeToElement(new{op=activation.Op.ToString(),actionId=activation.ActionId.ToString()},Json)){Kind="activate"};
  return this with{PendingActivations=PendingActivations.Where(p=>p.Op!=activation.Op).ToArray(),MetadataConflicts=MetadataConflicts.Append(new(operation,null,reason)).ToArray()};
 }
 public SyncWorkspace QueueQuickActionOrder(IReadOnlyList<string> ids)
 {
  var actions=Library("quickActions");
  var current=actions.Select(r=>r.GetProperty("id").GetString()!).ToArray();
  if(current.Length<2)return this;
  if(MetadataConflicts.Any(c=>c.Operation.Collection=="quickActions"&&c.Operation.Kind is "order" or "activate"))throw new InvalidOperationException("Resolve the pending quick action conflict first.");
  if(QuickActionWorkPending&&MetadataOutbox.Any(m=>m.Collection=="quickActions"&&m.Kind is "create" or "delete"))throw new InvalidOperationException("Synchronize pending quick action additions or removals before changing the order.");
  if(ids.Count!=current.Length||ids.Distinct(StringComparer.Ordinal).Count()!=ids.Count||!ids.All(current.Contains))throw new ArgumentException("Include every action exactly once.");
  return this with{QuickActionOrder=new(Guid.NewGuid(),ids.ToArray(),current)};
 }
 public SyncWorkspace ApplyQuickActionOrder(QuickActionOrder order)
 {
  var root=Snapshot is null?new JsonObject{["notes"]=new JsonArray()}:JsonNode.Parse(Snapshot.Value.GetRawText())!.AsObject();
  var actions=root["quickActions"]?.AsArray()??new JsonArray();
  var byId=actions.OfType<JsonNode>().ToDictionary(n=>n["id"]!.GetValue<string>(),n=>n.DeepClone());
  if(byId.Count!=order.Ids.Length||order.Ids.Any(id=>!byId.ContainsKey(id)))throw new InvalidDataException("Invalid quick action order acknowledgement; local order retained.");
  var next=new JsonArray();foreach(var id in order.Ids)next.Add(byId[id].DeepClone());
  root["quickActions"]=next;
  return this with{Snapshot=JsonSerializer.SerializeToElement(root,Json),QuickActionOrder=null};
 }
 public SyncWorkspace QuickActionOrderConflict(QuickActionOrder order,string[] serverIds,string reason)
 {
  var operation=new LibraryMutation(Guid.NewGuid(),"quickActions","",JsonSerializer.SerializeToElement(new{ids=order.Expected},Json),JsonSerializer.SerializeToElement(new{ids=order.Ids},Json)){Kind="order"};
  return this with{QuickActionOrder=null,MetadataConflicts=MetadataConflicts.Append(new(operation,JsonSerializer.SerializeToElement(new{ids=serverIds},Json),reason)).ToArray()};
 }
 public SyncWorkspace QueueStyle(string path,string content)
 {
  QuickActionRules.ValidateStyle(path,content);
  // Fail closed: a queued or conflicted file path change owns both stylesheet paths until it resolves.
  var mutations=Outbox.Concat(Conflicts.Select(c=>c.GetProperty("mutation").Deserialize<FileMutation>(Json)!)).ToList();
  var snapshots=Snapshot is null?[]:Snapshot.Value.GetProperty("notes").Deserialize<ServerFile[]>(Json)??[];
  foreach(var mutation in mutations)
  {
   var before=snapshots.FirstOrDefault(f=>f.Id==mutation.Id)?.Path;
   if(before is not null&&string.Equals(QuickActionRules.StylePath(before),path,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Resolve the pending file rename before editing its stylesheet.");
   if(string.Equals(QuickActionRules.StylePath(mutation.Path),path,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Resolve the pending file rename before editing its stylesheet.");
  }
  return this with{StyleOutbox=StyleOutbox.Where(s=>!string.Equals(s.Path,path,StringComparison.OrdinalIgnoreCase)).Append(new(path,content)).ToArray()};
 }
 public SyncWorkspace ApplyStyleAck(string path,string content)
 {
  var root=Snapshot is null?new JsonObject{["notes"]=new JsonArray()}:JsonNode.Parse(Snapshot.Value.GetRawText())!.AsObject();
  var styles=root["styles"]?.AsObject()??new JsonObject();
  styles[path]=content;root["styles"]=styles;
  return this with{Snapshot=JsonSerializer.SerializeToElement(root,Json),StyleOutbox=StyleOutbox.Where(s=>!string.Equals(s.Path,path,StringComparison.OrdinalIgnoreCase)).ToArray()};
 }
 public IReadOnlyDictionary<string,string> Styles()
 {
  var styles=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  if(Snapshot is not null&&Snapshot.Value.TryGetProperty("styles",out var map))
  {
   if(map.ValueKind!=JsonValueKind.Object)throw new InvalidDataException("Invalid server stylesheet map.");
   foreach(var style in map.EnumerateObject())
   {
    LocalFiles.ValidatePortablePath(style.Name);
    if(!style.Name.EndsWith(".css",StringComparison.OrdinalIgnoreCase)||style.Value.ValueKind!=JsonValueKind.String||style.Value.GetString()!.Length>100_000)throw new InvalidDataException("Invalid server stylesheet entry.");
    styles[style.Name]=style.Value.GetString()!;
   }
  }
  foreach(var edit in StyleOutbox)styles[edit.Path]=edit.Content;
  return styles;
 }
 public string? Style(string path)=>Styles().TryGetValue(path,out var value)?value:null;
}

public sealed partial class NativeWorkspace
{
 public async Task QueueQuickActionActivationAsync(Guid actionId,Guid op)
 {await gate.WaitAsync();try{await Commit(State.QueueQuickActionActivation(actionId,op));}finally{gate.Release();}}
 public async Task QueueQuickActionOrderAsync(IReadOnlyList<string> ids)
 {await gate.WaitAsync();try{await Commit(State.QueueQuickActionOrder(ids));}finally{gate.Release();}}
 public async Task QueueStyleAsync(string path,string content)
 {await gate.WaitAsync();try{await Commit(State.QueueStyle(path,content));}finally{gate.Release();}}
 // Hosted activation parity: sync and resolve pending changes first, then a durable op id
 // before the request, so a disconnection retries the exact same operation.
 public async Task<QuickActionActivationRecord> ActivateQuickActionAsync(ISyncTransport transport,Guid actionId,CancellationToken cancellation=default)
 {
  Guid op;
  await gate.WaitAsync(cancellation);try
  {
   if(!State.CleanForActivation())throw new InvalidOperationException("Sync and resolve pending changes before creating a file.");
   op=State.PendingActivationOp(actionId)??Guid.NewGuid();
   if(State.PendingActivationOp(actionId) is null)await Commit(State.QueueQuickActionActivation(actionId,op));
  }finally{gate.Release();}
  await SyncAsync(transport,cancellation);
  return State.ActivationLedger.LastOrDefault(l=>l.ActionId==actionId&&l.Op==op)??throw new InvalidOperationException("File could not be created; the request is retained and Sync will retry it.");
 }
}

// Styles are idempotent PUTs (hosted protocol has no style revisions), quick action order is a
// durable expected-order request, and activations replay the same op id until acknowledged.
public sealed class QuickActionSyncCoordinator(ISyncTransport transport,Func<SyncWorkspace,Task> persist)
{
 static string[] ServerQuickActionIds(JsonElement snapshot)
 {
  if(!snapshot.TryGetProperty("quickActions",out var actions)||actions.ValueKind!=JsonValueKind.Array)return[];
  var ids=new List<string>();
  foreach(var action in actions.EnumerateArray())
  {
   var id=action.GetProperty("id").GetString()??throw new InvalidDataException("Invalid server quick action identity.");
   if(!Guid.TryParse(id,out var parsed)||parsed==Guid.Empty)throw new InvalidDataException("Invalid server quick action identity.");
   ids.Add(id);
  }
  return ids.ToArray();
 }
 static bool SameSequence(string[] a,string[] b)=>a.Length==b.Length&&a.Zip(b,(x,y)=>x==y).All(pair=>pair);
 public async Task<SyncWorkspace> RunAsync(SyncWorkspace state,CancellationToken cancellation)
 {
  while(state.StyleOutbox.Count>0)
  {
   if(transport is not IStyleTransport styles)throw new InvalidOperationException("This transport cannot synchronize styles; local edits are retained.");
   var pending=state.StyleOutbox[0];
   QuickActionRules.ValidateStyle(pending.Path,pending.Content);
   var ack=await styles.PutStyleAsync(pending.Path,pending.Content,cancellation);
   if(ack.GetProperty("path").GetString()!=pending.Path||ack.GetProperty("content").GetString()!=pending.Content)throw new InvalidDataException("Invalid stylesheet acknowledgement; local edit retained.");
   state=state.ApplyStyleAck(pending.Path,pending.Content);await persist(state);
  }
  while(state.QuickActionOrder is not null)
  {
   if(transport is not IQuickActionTransport quick)throw new InvalidOperationException("This transport cannot synchronize quick actions; local order retained.");
   var order=state.QuickActionOrder;
   var snapshot=await transport.SnapshotAsync(cancellation);state=state.Receive(snapshot);
   var server=ServerQuickActionIds(snapshot);
   if(SameSequence(server,order.Ids)){state=state with{QuickActionOrder=null};await persist(state);continue;} // lost reply: already applied
   if(!SameSequence(server,order.Expected))
   {state=state.QuickActionOrderConflict(order,server,"Action order changed elsewhere");await persist(state);continue;}
   var response=await quick.ReorderQuickActionsAsync(order.Ids,order.Expected,cancellation);
   if(response.Conflict)
   {
    snapshot=await transport.SnapshotAsync(cancellation);state=state.Receive(snapshot);server=ServerQuickActionIds(snapshot);
    if(SameSequence(server,order.Ids)){state=state with{QuickActionOrder=null};await persist(state);continue;}
    state=state.QuickActionOrderConflict(order,server,"Action order changed elsewhere");await persist(state);continue;
   }
   if(!response.Result.TryGetProperty("ok",out var ok)||ok.ValueKind!=JsonValueKind.True)throw new InvalidDataException("Invalid quick action order acknowledgement; local order retained.");
   state=state.ApplyQuickActionOrder(order);await persist(state);
  }
  if(state.PendingActivations.Count>0)
  {
   if(transport is not IQuickActionTransport quick)throw new InvalidOperationException("This transport cannot synchronize quick actions; pending activations are retained.");
   foreach(var pending in state.PendingActivations.ToArray())
   {
    if(!state.CleanForActivation())break; // retained; resolve conflicts and synchronize again
    if(!state.Library("quickActions").Any(r=>r.GetProperty("id").GetString()==pending.ActionId.ToString()))
    {state=state.ActivationConflict(pending,"The quick action no longer exists on the server.");await persist(state);continue;}
    try
    {
     var note=await quick.ActivateQuickActionAsync(pending.ActionId,pending.Op,cancellation);
     state=state.CompleteActivation(pending,note);await persist(state);
    }
    catch(InvalidOperationException error) // deterministic server rejection
    {state=state.ActivationConflict(pending,error.Message);await persist(state);}
   }
  }
  return state;
 }
}
