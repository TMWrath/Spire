using System.Text.Json;
using System.Text.Json.Serialization;
namespace Spire.Core;

public sealed record ServerFile(Guid Id, int Rev, string Path, string Content, bool Deleted, string Time, JsonElement History, string[]? TemplateIds = null)
{
 [JsonExtensionData] public Dictionary<string,JsonElement>? AdditionalFields {get;init;}
}
public sealed record FileMutation(Guid Op, Guid Id, int Base, string Path, string Content, bool Deleted, string[]? TemplateIds = null);
public sealed partial record SyncWorkspace(string? Owner, JsonElement? Snapshot, IReadOnlyList<FileMutation> Outbox, IReadOnlyList<JsonElement> Conflicts)
{
 public IReadOnlyDictionary<string,string> Assets {get;init;}=new Dictionary<string,string>();
 public IReadOnlyList<string> PendingAssets {get;init;}=[];
 public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
 public static SyncWorkspace Empty => new(null,null,[],[]);
 public SyncWorkspace BindOwner(string owner)
 {
  if(Owner is not null && Owner != owner)throw new InvalidOperationException("This workspace belongs to another account. Open a separate workspace; local drafts are retained.");
  return this with {Owner=owner};
 }
 public SyncWorkspace Queue(ServerFile file)
 {
  LocalFiles.ValidatePath(file.Path);
  if(!file.Deleted&&FolderDeletionContains(file.Path))throw new InvalidOperationException("Resolve the pending folder deletion before saving files inside it.");
  if(!file.Deleted&&Folders().Any(folder=>string.Equals(folder,file.Path,StringComparison.OrdinalIgnoreCase)||folder.StartsWith(file.Path+"/",StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("A folder occupies the file path.");
  if(file.Content.Length>1_000_000)throw new ArgumentException("File exceeds the server content limit.");
  // Fail closed: pending stylesheet edits and pending file path changes cannot coexist; the hosted
  // server renames styles with notes, so ordering both offline would fork the stylesheet identity.
  var oldVisible=VisibleFiles().FirstOrDefault(f=>f.Id==file.Id);
  if(oldVisible is not null&&!string.Equals(oldVisible.Path,file.Path,StringComparison.OrdinalIgnoreCase))
  {
   var beforeStyle=oldVisible.Path.EndsWith(".md",StringComparison.OrdinalIgnoreCase)?QuickActionRules.StylePath(oldVisible.Path):null;
   var afterStyle=file.Path.EndsWith(".md",StringComparison.OrdinalIgnoreCase)?QuickActionRules.StylePath(file.Path):null;
   if(beforeStyle is not null&&StyleOutbox.Any(s=>string.Equals(s.Path,beforeStyle,StringComparison.OrdinalIgnoreCase))||afterStyle is not null&&StyleOutbox.Any(s=>string.Equals(s.Path,afterStyle,StringComparison.OrdinalIgnoreCase)))
    throw new InvalidOperationException("Resolve the pending stylesheet edit before changing this file's path.");
  }
  var old=Outbox.FirstOrDefault(m=>m.Id==file.Id);
  var mutation=new FileMutation(Guid.NewGuid(),file.Id,old?.Base??file.Rev,file.Path,file.Content,file.Deleted,file.TemplateIds);
  return this with {Outbox=Outbox.Where(m=>m.Id!=file.Id).Append(mutation).ToArray()};
 }
 public SyncWorkspace Acknowledge(Guid op, JsonElement? conflict=null)
 {
  if(!Outbox.Any(m=>m.Op==op))throw new InvalidOperationException("Unknown operation acknowledgement.");
  return this with {Outbox=Outbox.Where(m=>m.Op!=op).ToArray(),Conflicts=conflict is null?Conflicts:Conflicts.Append(conflict.Value.Clone()).ToArray()};
 }
 public SyncWorkspace Receive(JsonElement snapshot)
 {
  if(!snapshot.TryGetProperty("notes",out var notes)||notes.ValueKind!=JsonValueKind.Array)throw new InvalidDataException("Snapshot has no files.");
  try
  {
   var files=notes.Deserialize<ServerFile[]>(Json)??throw new InvalidDataException("Missing file records.");
   var ids=new HashSet<Guid>();var paths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(var file in files)
   {
    if(file.Id==Guid.Empty||!ids.Add(file.Id)||file.Rev<0||file.Content is null||file.Content.Length>1_000_000||file.History.ValueKind!=JsonValueKind.Array)throw new InvalidDataException("Invalid file record.");
    LocalFiles.ValidatePath(file.Path);
    if(!file.Deleted&&!paths.Add(file.Path))throw new InvalidDataException("Colliding active server file paths.");
   }
   foreach(var path in paths)if(paths.Any(other=>other!=path&&path.StartsWith(other+"/",StringComparison.OrdinalIgnoreCase)))throw new InvalidDataException("Server file obstructs folder path.");
   if(snapshot.TryGetProperty("styles",out var styleMap))
   {
    if(styleMap.ValueKind!=JsonValueKind.Object)throw new InvalidDataException("Invalid server stylesheet map.");
    foreach(var style in styleMap.EnumerateObject())
    {
     LocalFiles.ValidatePortablePath(style.Name);
     if(!style.Name.EndsWith(".css",StringComparison.OrdinalIgnoreCase)||style.Value.ValueKind!=JsonValueKind.String||style.Value.GetString()!.Length>100_000)throw new InvalidDataException("Invalid server stylesheet entry.");
    }
   }
  }
  catch(Exception e)when(e is ArgumentException or JsonException or NullReferenceException){throw new InvalidDataException("Unsafe or malformed server snapshot; local state retained.",e);}
  _=SnapshotFolders(snapshot);
  return this with {Snapshot=snapshot.Clone()};
 }
 public SyncWorkspace ApplyAcknowledged(JsonElement result)
 {
  var file=result.Deserialize<ServerFile>(Json)??throw new InvalidDataException("Invalid mutation acknowledgement.");
  var root=Snapshot is null?new System.Text.Json.Nodes.JsonObject():System.Text.Json.Nodes.JsonNode.Parse(Snapshot.Value.GetRawText())!.AsObject();
  var notes=root["notes"]?.AsArray()??new System.Text.Json.Nodes.JsonArray();
  for(var i=notes.Count-1;i>=0;i--)if(notes[i]?["id"]?.GetValue<Guid>()==file.Id)notes.RemoveAt(i);
  notes.Add(System.Text.Json.Nodes.JsonNode.Parse(result.GetRawText()));root["notes"]=notes;
  return this with {Snapshot=JsonSerializer.SerializeToElement(root,Json)};
 }
 public SyncWorkspace ResolveConflict(string id,bool keepLocal)
 {
  var conflict=Conflicts.Single(c=>c.GetProperty("id").GetString()==id);
  var m=conflict.GetProperty("mutation").Deserialize<FileMutation>(Json)!;
  var next=this with {Conflicts=Conflicts.Where(c=>c.GetProperty("id").GetString()!=id).ToArray()};
  if(!keepLocal)return next;
  var remote=Snapshot!.Value.GetProperty("notes").Deserialize<List<ServerFile>>(Json)!.FirstOrDefault(f=>f.Id==m.Id);
  return next.Queue(new(m.Id,remote?.Rev??conflict.GetProperty("current").GetInt32(),m.Path,m.Content,m.Deleted,"",remote?.History??JsonSerializer.SerializeToElement(Array.Empty<object>()),m.TemplateIds));
 }
 public IReadOnlyList<ServerFile> VisibleFiles()
 {
  var files=Snapshot is null?new List<ServerFile>():Snapshot.Value.GetProperty("notes").Deserialize<List<ServerFile>>(Json)??throw new InvalidDataException("Invalid server files.");
  foreach(var m in Conflicts.Select(c=>c.GetProperty("mutation").Deserialize<FileMutation>(Json)!).Concat(Outbox))
  {
   var current=files.FirstOrDefault(f=>f.Id==m.Id);
   files.RemoveAll(f=>f.Id==m.Id);
   files.Add(new(m.Id,m.Base,m.Path,m.Content,m.Deleted,current?.Time??"",current?.History??JsonSerializer.SerializeToElement(Array.Empty<object>()),m.TemplateIds){AdditionalFields=current?.AdditionalFields});
  }
  return files;
 }
}
