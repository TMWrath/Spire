using System.Text.Json;
namespace Spire.Core;

public interface ISyncTransport
{
 Task<JsonElement> IdentityAsync(CancellationToken cancellation);
 Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement mutation,CancellationToken cancellation);
 Task<JsonElement> SnapshotAsync(CancellationToken cancellation);
}

public interface ISyncAssetTransport
{
 Task<byte[]?> DownloadAssetAsync(string path,CancellationToken cancellation);
 Task UploadAssetAsync(string path,byte[] bytes,CancellationToken cancellation);
}

// Caller owns single-writer serialization. Every acknowledgement is durable before the next request.
public sealed class SyncCoordinator(ISyncTransport transport, Func<SyncWorkspace,Task> persist)
{
 public async Task<SyncWorkspace> RunAsync(SyncWorkspace state,CancellationToken cancellation=default)
 {
  var identity=await transport.IdentityAsync(cancellation);
  state=state.BindOwner(identity.GetProperty("owner").GetString()??throw new InvalidDataException("Missing owner."));
  await persist(state);
  state=await new FolderSyncCoordinator(transport,persist).RunAsync(state,false,cancellation);
  state=await new MetadataSyncCoordinator(transport,persist).RunAsync(state,cancellation);
  if(state.MetadataConflicts.Any(c=>c.Operation.Kind=="create"&&c.Operation.Collection=="sources"))return state; // Do not send provisional citation identities.
  foreach(var path in state.PendingAssets.ToArray())
  {
   if(transport is not ISyncAssetTransport assetTransport)throw new InvalidOperationException("This transport cannot synchronize attachments.");
   LocalFiles.ValidatePortablePath(path);
   var bytes=Convert.FromBase64String(state.Assets[path]);
   var remote=await assetTransport.DownloadAssetAsync(path,cancellation);
   if(remote is null)await assetTransport.UploadAssetAsync(path,bytes,cancellation);
   else if(!remote.SequenceEqual(bytes))throw new InvalidOperationException("Attachment conflict: "+path+". Local bytes and pending upload retained.");
   state=state with{PendingAssets=state.PendingAssets.Where(p=>p!=path).ToArray()};await persist(state);
  }
  while(state.Outbox.Count>0)
  {
   var pending=state.Outbox[0];
   var response=await transport.MutateAsync(JsonSerializer.SerializeToElement(pending,SyncWorkspace.Json),cancellation);
   if(response.Conflict)
   {
    if(!response.Result.TryGetProperty("details",out var details)||details.ValueKind!=JsonValueKind.Object)
     throw new InvalidDataException("Conflict response has no recoverable mutation. Outbox retained.");
    state=state.Acknowledge(pending.Op,details);
   }
   else state=state.ApplyAcknowledged(response.Result).Acknowledge(pending.Op);
   await persist(state);
  }
  state=await new MetadataSyncCoordinator(transport,persist).RunAsync(state,cancellation,deletions:true);
  state=await new FolderSyncCoordinator(transport,persist).RunAsync(state,true,cancellation);
  // Styles, quick action order and pending activations run after every outbox is drained:
  // hosted activation requires a clean workspace, and a reply lost here replays idempotently.
  state=await new QuickActionSyncCoordinator(transport,persist).RunAsync(state,cancellation);
  var snapshot=await transport.SnapshotAsync(cancellation);
  // A fresh server snapshot must not erase conflicts captured by this client.
  var next=state.Receive(snapshot);
  if(snapshot.TryGetProperty("attachments",out var inventory))
  {
   if(inventory.ValueKind!=JsonValueKind.Array)throw new InvalidDataException("Invalid attachment inventory.");
   var assets=new Dictionary<string,string>(state.Assets);
   var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(var item in inventory.EnumerateArray())
   {
    var path=item.GetProperty("path").GetString()??throw new InvalidDataException("Missing attachment path.");
    LocalFiles.ValidatePortablePath(path);
    if(!seen.Add(path)||path.EndsWith(".md",StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Invalid attachment path.");
    var size=item.GetProperty("size").GetInt32();
    if(size<0||size>10_000_000)throw new InvalidDataException("Invalid attachment size.");
    if(transport is not ISyncAssetTransport assetTransport)throw new InvalidOperationException("This transport cannot download attachments.");
    var bytes=await assetTransport.DownloadAssetAsync(path,cancellation);
    if(bytes is null||bytes.Length!=size)throw new InvalidDataException("Attachment missing or changed during snapshot download.");
    assets[path]=Convert.ToBase64String(bytes);
   }
   next=next with{Assets=assets};
  }
  state=next;
  await persist(state);
  return state;
 }
}
