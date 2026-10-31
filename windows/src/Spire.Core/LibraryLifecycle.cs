using System.Text.Json;
using System.Text.Json.Nodes;
namespace Spire.Core;

public static partial class LibraryRules
{
 public static JsonElement NewRecord(string collection)
 {
  var root=new JsonObject();foreach(var field in Fields(collection).Keys)root[field]="";
  root["id"]=Guid.NewGuid().ToString();root["created"]=DateTime.UtcNow.ToString("O");
  if(collection=="templates"){root["category"]="section";root["sourcePath"]="Writing/Untitled.md";}
  else if(collection=="quickActions"){root.Remove("created");root["label"]="";root["folder"]="Writing";root["namePattern"]="Untitled {date}.md";root["templateId"]=null;root["revision"]=1;}
  else{root["kind"]="book";root["revision"]=1;}
  return JsonSerializer.SerializeToElement(root,SyncWorkspace.Json);
 }
}
public sealed partial record SyncWorkspace
{
 public SyncWorkspace QueueLibraryCreate(string collection,JsonElement value)
 {
  _=LibraryRules.Fields(collection);
  // Sources use a provisional local identity until the server assigns the canonical UUID.
  // An uncertain POST is never automatically repeated: explicit resolution is required.
  value=collection=="quickActions"?QuickActionRules.Normalize(value,value,Library("templates")):LibraryRules.Normalize(collection,value,value);
  var records=Library(collection);var id=value.GetProperty("id").GetString()!;
  if(records.Count>=(collection=="templates"?100:1000)||records.Any(r=>r.GetProperty("id").GetString()==id||collection=="templates"&&r.GetProperty("category").GetString()==value.GetProperty("category").GetString()&&string.Equals(r.GetProperty("title").GetString(),value.GetProperty("title").GetString(),StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("Library identity/title already exists, or library is full.");
  return this with{MetadataOutbox=MetadataOutbox.Append(new LibraryMutation(Guid.NewGuid(),collection,id,JsonSerializer.SerializeToElement((object?)null),value){Kind="create"}).ToArray()};
 }
 public SyncWorkspace QueueLibraryDelete(string collection,string id)
 {
  if(collection is not ("sources" or "quickActions"))throw new InvalidOperationException("The hosted protocol has no template deletion endpoint.");
  if(MetadataConflicts.Any(c=>c.Operation.Collection==collection&&c.Operation.RecordId==id))throw new InvalidOperationException("Resolve this source conflict first.");
  var record=Library(collection).Single(r=>r.GetProperty("id").GetString()==id);
  if(collection=="sources"&&VisibleFiles().Any(f=>PortableCitations.Read(f.Content).Any(c=>c.SourceId.ToString()==id)))throw new InvalidOperationException("This source is cited in files or Trash. Remove those citations before deleting it.");
  if(collection=="quickActions"&&PendingActivations.Any(p=>p.ActionId.ToString()==id))throw new InvalidOperationException("This action has a pending file activation. Synchronize before deleting it.");
  var prior=MetadataOutbox.SingleOrDefault(m=>m.Collection==collection&&m.RecordId==id);
  if(prior is {Kind:"create",Attempted:false})return this with{MetadataOutbox=MetadataOutbox.Where(m=>m.Id!=prior.Id).ToArray()};
  if(prior is {Kind:"create"})throw new InvalidOperationException("Resolve the uncertain creation before deleting it.");
  return this with{MetadataOutbox=MetadataOutbox.Where(m=>m.Collection!=collection||m.RecordId!=id).Append(new LibraryMutation(Guid.NewGuid(),collection,id,prior?.Expected??record,record){Kind="delete"}).ToArray()};
 }
 internal SyncWorkspace FinishCreation(LibraryMutation m,JsonElement result)
 {
  if(result.ValueKind!=JsonValueKind.Object||!result.TryGetProperty("id",out var id)||!Guid.TryParse(id.GetString(),out var parsed)||parsed==Guid.Empty||!LibraryRules.SameInput(m.Collection,result,m.Value))throw new InvalidDataException("Invalid creation acknowledgement; pending draft retained.");
  var next=ReceiveLibraryRecord(m.Collection,result) with{MetadataOutbox=MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray()};
  if(m.Collection=="sources")return next.RebindSource(m.RecordId,id.GetString()!);
  if(m.Collection=="quickActions")return next; // No file references a quick action; nothing to rebind.
  // Metadata is synchronized before file mutations, so no old provisional identity is sent.
  var before="saved-"+m.RecordId;var after="saved-"+id.GetString()!;
  return next with{Outbox=next.Outbox.Select(p=>p with{TemplateIds=p.TemplateIds?.Select(t=>t==before?after:t).Distinct().ToArray()}).ToArray()};
 }
}
public sealed partial class MetadataSyncCoordinator
{
 async Task<SyncWorkspace> RunLifecycle(SyncWorkspace state,LibraryMutation m,IMetadataSyncTransport metadata,CancellationToken cancellation)
 {
  var snapshot=await transport.SnapshotAsync(cancellation);var next=state.Receive(snapshot);
  var records=snapshot.TryGetProperty(m.Collection,out var array)?array.EnumerateArray().ToArray():[];
  if(m.Kind=="create")
  {
   if(m.Collection is not ("templates" or "sources" or "quickActions"))throw new InvalidDataException("Unsupported creation operation; retained locally.");
   if(m.Attempted)
   {
    var matches=records.Where(r=>!m.BaselineIds.Contains(r.GetProperty("id").GetString())&&LibraryRules.SameInput(m.Collection,r,m.Value)).ToArray();
    if(m.Collection=="sources")
    {
     next=Conflict(next,m,matches.Length==1?matches[0]:default,"Source creation acknowledgement is uncertain. "+(matches.Length==1?"Review and explicitly adopt the matching server source.":"No unique matching source. An explicit retry may create a duplicate; inspect the server library first."));
     await persist(next);return next;
    }
    if(matches.Length>1)throw new InvalidOperationException("Ambiguous creation recovery; no additional record was created. Pending draft retained.");
    if(matches.Length==1){next=next.FinishCreation(m,matches[0]);await persist(next);return next;}
   }
   if(m.Collection=="templates"&&records.Any(r=>r.GetProperty("category").GetString()==m.Value.GetProperty("category").GetString()&&string.Equals(r.GetProperty("title").GetString(),m.Value.GetProperty("title").GetString(),StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("A server template already uses this category/title. Pending template retained; no duplicate created.");
   m=m with{Attempted=true,BaselineIds=m.Attempted?m.BaselineIds:records.Select(r=>r.GetProperty("id").GetString()!).ToArray()};
   next=next with{MetadataOutbox=next.MetadataOutbox.Select(p=>p.Id==m.Id?m:p).ToArray()};await persist(next);
   var response=await metadata.UpdateMetadataAsync(m,cancellation);
   if(response.Conflict)throw new InvalidOperationException("Server creation rejected; synchronize again to reconcile or retain this draft for recovery.");
   next=next.FinishCreation(m,response.Result);await persist(next);return next;
  }
  if(m.Kind!="delete"||m.Collection is not ("sources" or "quickActions"))throw new InvalidDataException("Unknown library operation; retained locally.");
  var remote=records.SingleOrDefault(r=>r.GetProperty("id").GetString()==m.RecordId);
  if(remote.ValueKind==JsonValueKind.Undefined){next=next with{MetadataOutbox=next.MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray()};await persist(next);return next;}
  if(!LibraryRules.SameInput(m.Collection,remote,m.Expected)||remote.GetProperty("revision").GetInt32()!=m.Expected.GetProperty("revision").GetInt32())
  {next=Conflict(next,m,remote,m.Collection=="sources"?"Source changed before deletion.":"Quick action changed before deletion.");await persist(next);return next;}
  // A pending edit can introduce a citation after deletion was queued. Refuse that race too.
  if(m.Collection=="sources"&&next.VisibleFiles().Any(f=>PortableCitations.Read(f.Content).Any(c=>c.SourceId.ToString()==m.RecordId)))throw new InvalidOperationException("Source deletion blocked by a file or Trash citation; pending deletion retained.");
  await persist(next);var deleted=await metadata.UpdateMetadataAsync(m,cancellation);
  if(deleted.Conflict){snapshot=await transport.SnapshotAsync(cancellation);next=next.Receive(snapshot);remote=snapshot.GetProperty(m.Collection).EnumerateArray().SingleOrDefault(r=>r.GetProperty("id").GetString()==m.RecordId);next=Conflict(next,m,remote,"Server deletion was rejected.");}
  else
  {
   if(!deleted.Result.TryGetProperty("ok",out var ok)||ok.ValueKind!=JsonValueKind.True)throw new InvalidDataException("Invalid deletion acknowledgement; operation retained.");
   var root=JsonNode.Parse(next.Snapshot!.Value.GetRawText())!.AsObject();var list=root[m.Collection]!.AsArray();for(int i=list.Count-1;i>=0;i--)if(list[i]!["id"]!.GetValue<string>()==m.RecordId)list.RemoveAt(i);
   next=next with{Snapshot=JsonSerializer.SerializeToElement(root,SyncWorkspace.Json),MetadataOutbox=next.MetadataOutbox.Where(p=>p.Id!=m.Id).ToArray()};
  }
  await persist(next);return next;
 }
}
