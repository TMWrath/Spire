using System.Text.Json;
using System.Text.Json.Nodes;
namespace Spire.Core;
public sealed record LibraryMutation(Guid Id,string Collection,string RecordId,JsonElement Expected,JsonElement Value)
{ public string Kind {get;init;}="update"; public bool Attempted {get;init;} public string[] BaselineIds {get;init;}=[]; }
public sealed record LibraryConflict(LibraryMutation Operation,JsonElement? Remote,string Reason);
public interface IMetadataSyncTransport
{
 Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation mutation,CancellationToken cancellation);
}
public sealed partial record SyncWorkspace
{
 public IReadOnlyList<LibraryMutation> MetadataOutbox {get;init;}=[];
 public IReadOnlyList<LibraryConflict> MetadataConflicts {get;init;}=[];
 public IReadOnlyList<JsonElement> Library(string collection)
 {
  LibraryRules.Fields(collection);var records=Snapshot is not null&&Snapshot.Value.TryGetProperty(collection,out var array)?array.EnumerateArray().Select(r=>r.Clone()).ToList():[];
  foreach(var m in MetadataConflicts.Select(c=>c.Operation).Concat(MetadataOutbox).Where(m=>m.Collection==collection&&m.Kind is not "order" and not "activate"))
  {records.RemoveAll(r=>r.GetProperty("id").GetString()==m.RecordId);if(m.Kind!="delete")records.Add(m.Value.Clone());}
  return records;
 }
 public SyncWorkspace QueueLibrary(string collection,JsonElement value)
 {
  var id=value.GetProperty("id").GetString()??throw new ArgumentException("Missing metadata identity.");
  if(MetadataConflicts.Any(c=>c.Operation.Collection==collection&&c.Operation.RecordId==id))throw new InvalidOperationException("Resolve the metadata conflict first; the draft is retained.");
  var existing=Library(collection).SingleOrDefault(r=>r.GetProperty("id").GetString()==id);
  if(existing.ValueKind==JsonValueKind.Undefined)throw new InvalidOperationException("Only existing library records can be updated through this adapter.");
  var normalized=collection=="quickActions"?QuickActionRules.Normalize(value,existing,Library("templates")):LibraryRules.Normalize(collection,value,existing);var old=MetadataOutbox.SingleOrDefault(m=>m.Collection==collection&&m.RecordId==id);
  if(LibraryRules.SameInput(collection,normalized,existing))return this;
  if(old?.Kind=="delete")throw new InvalidOperationException("This record is pending deletion.");
  var m=new LibraryMutation(Guid.NewGuid(),collection,id,old?.Expected??existing,normalized){Kind=old?.Kind??"update"};
  if(old?.Attempted==true)throw new InvalidOperationException("Synchronize the uncertain creation before editing again; draft retained.");
  return this with{MetadataOutbox=MetadataOutbox.Where(p=>p.Collection!=collection||p.RecordId!=id).Append(m).ToArray()};
 }
 public SyncWorkspace ReceiveLibraryRecord(string collection,JsonElement record)
 {
  var root=Snapshot is null?new JsonObject{["notes"]=new JsonArray()}:JsonNode.Parse(Snapshot.Value.GetRawText())!.AsObject();var records=root[collection]?.AsArray()??new JsonArray();
  var id=record.GetProperty("id").GetString();
  var prior=records.SingleOrDefault(r=>r?["id"]?.GetValue<string>()==id)?.DeepClone().AsObject()??new JsonObject();
  foreach(var field in record.EnumerateObject())prior[field.Name]=JsonNode.Parse(field.Value.GetRawText());
  for(int i=records.Count-1;i>=0;i--)if(records[i]?["id"]?.GetValue<string>()==id)records.RemoveAt(i);
  records.Add(prior);root[collection]=records;return this with{Snapshot=JsonSerializer.SerializeToElement(root,Json)};
 }
 public SyncWorkspace ResolveLibrary(Guid id,bool keepLocal)
 {
  var c=MetadataConflicts.Single(c=>c.Operation.Id==id);var next=this with{MetadataConflicts=MetadataConflicts.Where(c=>c.Operation.Id!=id).ToArray()};
  if(c.Operation.Collection=="quickActions"&&c.Operation.Kind=="order")
  {
   if(!keepLocal)return next;
   return next.QueueQuickActionOrder(c.Operation.Value.GetProperty("ids").EnumerateArray().Select(v=>v.GetString()!).ToArray());
  }
  if(c.Operation.Collection=="quickActions"&&c.Operation.Kind=="activate")
  {
   if(!keepLocal)return next;
   var actionId=c.Operation.Value.GetProperty("actionId").GetString();var op=c.Operation.Value.GetProperty("op").GetString();
   if(!Guid.TryParse(actionId,out var parsedAction)||!Guid.TryParse(op,out var parsedOp))throw new InvalidOperationException("Invalid retained activation; discard it explicitly.");
   return next.QueueQuickActionActivation(parsedAction,parsedOp);
  }
  if(c.Operation.Kind=="create"&&c.Operation.Collection=="sources")
  {
   if(!keepLocal)
   {
    if(VisibleFiles().Any(f=>PortableCitations.Read(f.Content).Any(citation=>citation.SourceId.ToString()==c.Operation.RecordId)))throw new InvalidOperationException("This provisional source is cited in files or Trash. Remove or rebind those citations before discarding the source draft.");
    return next;
   }
   if(c.Remote is not null)return next.FinishCreation(c.Operation,c.Remote.Value);
   return next with{MetadataOutbox=next.MetadataOutbox.Append(c.Operation with{Attempted=false,BaselineIds=[]}).ToArray()};
  }
  if(!keepLocal)return next;
  if(c.Operation.Kind=="delete")return next.QueueLibraryDelete(c.Operation.Collection,c.Operation.RecordId);
  if(c.Remote is null)throw new InvalidOperationException("The server removed this library record. Export the retained draft before accepting deletion; automatic recreation is not safe.");
  var value=JsonNode.Parse(c.Operation.Value.GetRawText())!.AsObject();foreach(var key in new[]{"id","created","revision"})if(c.Remote.Value.TryGetProperty(key,out var v))value[key]=JsonNode.Parse(v.GetRawText());
  return next.QueueLibrary(c.Operation.Collection,JsonSerializer.SerializeToElement(value,Json));
 }
}
public static partial class LibraryRules
{
 static readonly Dictionary<string,int> Template=new(){["title"]=100,["category"]=20,["content"]=1_000_000,["sourcePath"]=240};
 static readonly Dictionary<string,int> Source=new(){["kind"]=20,["title"]=300,["author"]=300,["year"]=40,["edition"]=100,["publisher"]=200,["isbn"]=80,["url"]=2000,["accessed"]=40,["attachment"]=240,["description"]=10_000};
 static readonly Dictionary<string,int> QuickAction=new(){["label"]=100,["folder"]=240,["namePattern"]=120,["templateId"]=100};
 public static IReadOnlyDictionary<string,int> Fields(string collection)=>collection switch{"templates"=>Template,"sources"=>Source,"quickActions"=>QuickAction,_=>throw new ArgumentException("Unsupported metadata collection.")};
 // Snapshot property is camelCase, the hosted route is kebab-case for quick actions.
 public static string Route(string collection)=>collection=="quickActions"?"quick-actions":collection;
 static string Text(JsonElement e,string key)=>e.TryGetProperty(key,out var value)&&value.ValueKind==JsonValueKind.String?value.GetString()!:"";
 public static bool SameInput(string collection,JsonElement a,JsonElement b)=>Fields(collection).Keys.All(key=>Text(a,key)==Text(b,key));
 public static JsonElement Normalize(string collection,JsonElement value,JsonElement original)
 {
  var fields=Fields(collection);if(value.ValueKind!=JsonValueKind.Object||!Guid.TryParse(Text(value,"id"),out var id)||id==Guid.Empty||Text(value,"id")!=Text(original,"id"))throw new ArgumentException("Invalid library record identity.");
  var root=JsonNode.Parse(original.GetRawText())!.AsObject();
  foreach(var field in value.EnumerateObject())
  {
   if(fields.ContainsKey(field.Name))continue;
   if(!original.TryGetProperty(field.Name,out var before)||!JsonElement.DeepEquals(before,field.Value))throw new ArgumentException("Read-only or unknown metadata fields cannot be changed.");
  }
  foreach(var pair in fields)
  {
   if(!value.TryGetProperty(pair.Key,out var raw)||raw.ValueKind!=JsonValueKind.String)throw new ArgumentException("Library field must be text: "+pair.Key);
   string text=raw.GetString()!;if(pair.Key is not "content" and not "description" and not "accessed")text=text.Trim();
   if(text.Length>pair.Value||(pair.Key=="title"&&text.Length==0))throw new ArgumentException("Invalid library field length: "+pair.Key);root[pair.Key]=text;
  }
  if(collection=="templates")
  {if(root["category"]!.GetValue<string>() is not "section" and not "full")throw new ArgumentException("Invalid template category.");LocalFiles.ValidatePortablePath(root["sourcePath"]!.GetValue<string>());}
  else
  {
   if(root["kind"]!.GetValue<string>() is not ("book" or "website" or "image" or "audio" or "video" or "document" or "other"))throw new ArgumentException("Invalid source kind.");
   var url=root["url"]!.GetValue<string>();if(url.Length>0&&(!Uri.TryCreate(url,UriKind.Absolute,out var uri)||uri.Scheme is not ("http" or "https")))throw new ArgumentException("Use an HTTP or HTTPS source URL.");
   var attachment=root["attachment"]!.GetValue<string>();if(attachment.Length>0)LocalFiles.ValidatePortablePath(attachment);
   if(!original.TryGetProperty("revision",out var revision)||revision.GetInt32()<1)throw new ArgumentException("Missing source revision.");
  }
  return JsonSerializer.SerializeToElement(root,SyncWorkspace.Json);
 }
 public static JsonElement Payload(LibraryMutation m)
 {
  if(m.Collection=="quickActions")
  {
   var action=new JsonObject{{"label",Text(m.Value,"label")},{"folder",Text(m.Value,"folder")},{"namePattern",Text(m.Value,"namePattern")}};
   var templateId=Text(m.Value,"templateId");action["templateId"]=templateId.Length==0?null:templateId;
   if(m.Kind=="create")return JsonSerializer.SerializeToElement(action,SyncWorkspace.Json);
   action["revision"]=m.Expected.GetProperty("revision").GetInt32();
   return JsonSerializer.SerializeToElement(action,SyncWorkspace.Json);
  }
  var root=new JsonObject();foreach(var field in Fields(m.Collection).Keys)root[field]=Text(m.Value,field);
  if(m.Kind=="create")return JsonSerializer.SerializeToElement(root,SyncWorkspace.Json);
  if(m.Collection=="templates")root["expectedContent"]=Text(m.Expected,"content");else root["expectedRevision"]=m.Expected.GetProperty("revision").GetInt32();
  return JsonSerializer.SerializeToElement(root,SyncWorkspace.Json);
 }
}
public sealed partial class MetadataSyncCoordinator(ISyncTransport transport,Func<SyncWorkspace,Task> persist)
{
 public async Task<SyncWorkspace> RunAsync(SyncWorkspace state,CancellationToken cancellation,bool deletions=false)
 {
  while(state.MetadataOutbox.Any(m=>(m.Kind=="delete")==deletions))
  {
   if(transport is not IMetadataSyncTransport metadata)throw new InvalidOperationException("Transport cannot synchronize library edits; local drafts are retained.");
   var m=state.MetadataOutbox.First(m=>(m.Kind=="delete")==deletions);
   if(m.Kind!="update"){state=await RunLifecycle(state,m,metadata,cancellation);continue;}
   var snapshot=await transport.SnapshotAsync(cancellation);var next=state.Receive(snapshot);
   var remote=snapshot.TryGetProperty(m.Collection,out var array)?array.EnumerateArray().SingleOrDefault(r=>r.GetProperty("id").GetString()==m.RecordId):default;
   if(remote.ValueKind!=JsonValueKind.Undefined&&LibraryRules.SameInput(m.Collection,remote,m.Value))
   {state=next with{MetadataOutbox=next.MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray()};await persist(state);continue;}
   bool changed=remote.ValueKind==JsonValueKind.Undefined||!LibraryRules.SameInput(m.Collection,remote,m.Expected)||m.Collection is "sources" or "quickActions"&&remote.GetProperty("revision").GetInt32()!=m.Expected.GetProperty("revision").GetInt32();
   if(changed)
   {state=Conflict(next,m,remote,"Server metadata changed or was removed.");await persist(state);continue;}
   // Snapshot is durable before contacting a non-idempotent metadata endpoint.
   state=next;await persist(state);var response=await metadata.UpdateMetadataAsync(m,cancellation);
   if(response.Conflict)
   {
    snapshot=await transport.SnapshotAsync(cancellation);next=state.Receive(snapshot);
    remote=snapshot.TryGetProperty(m.Collection,out var conflictArray)?conflictArray.EnumerateArray().SingleOrDefault(r=>r.GetProperty("id").GetString()==m.RecordId):default;
    state=Conflict(next,m,remote,"Server rejected the metadata revision.");
   }
   else
   {
    if(response.Result.ValueKind!=JsonValueKind.Object||response.Result.GetProperty("id").GetString()!=m.RecordId||!LibraryRules.SameInput(m.Collection,response.Result,m.Value))throw new InvalidDataException("Invalid metadata acknowledgement; local pending edit retained.");
    state=state.ReceiveLibraryRecord(m.Collection,response.Result) with{MetadataOutbox=state.MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray()};
   }
   await persist(state);
  }
  return state;
 }
 static SyncWorkspace Conflict(SyncWorkspace state,LibraryMutation m,JsonElement remote,string reason)=>state with{MetadataOutbox=state.MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray(),MetadataConflicts=state.MetadataConflicts.Append(new(m,remote.ValueKind==JsonValueKind.Undefined?null:remote.Clone(),reason)).ToArray()};
}
