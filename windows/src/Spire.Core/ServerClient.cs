using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
namespace Spire.Core;

// Explicit connection only: construction and offline launch never contact a server.
public sealed class ServerClient : IDisposable, ISyncTransport, ISyncAssetTransport, IMetadataSyncTransport, IFolderSyncTransport, IQuickActionTransport, IStyleTransport
{
 private readonly HttpClient http;
 private string? csrf;
 public ServerClient(Uri server,HttpMessageHandler? handler=null)
 {
  if(server.Scheme!=Uri.UriSchemeHttps || !string.IsNullOrEmpty(server.UserInfo) || server.AbsolutePath!="/")
   throw new ArgumentException("Use the HTTPS server origin without credentials or a path.");
  http=new(handler??new HttpClientHandler {CookieContainer=new CookieContainer(),AllowAutoRedirect=false})
   {BaseAddress=server,Timeout=TimeSpan.FromSeconds(30)};
  http.DefaultRequestHeaders.Add("Origin",server.GetLeftPart(UriPartial.Authority));
 }
 public async Task<JsonElement> LoginAsync(string username,string password,string device,CancellationToken cancellation=default)
 {
  using var response=await http.PostAsJsonAsync("api/login",new {username,password,device},cancellation);
  response.EnsureSuccessStatusCode();
  using var me=await http.GetAsync("api/me",cancellation);me.EnsureSuccessStatusCode();
  var identity=await me.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
  csrf=identity.GetProperty("csrf").GetString()??throw new InvalidDataException("Missing CSRF token.");
  return identity;
 }
 public async Task<JsonElement> SnapshotAsync(CancellationToken cancellation=default)
 {
  using var response=await http.GetAsync("api/snapshot",cancellation);response.EnsureSuccessStatusCode();
  return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
 }
 public async Task<(bool Conflict,JsonElement Result)> MutateAsync(JsonElement mutation,CancellationToken cancellation=default)
 {
  if(csrf is null)throw new InvalidOperationException("Sign in before synchronizing.");
  using var request=new HttpRequestMessage(HttpMethod.Post,"api/mutate"){Content=JsonContent.Create(mutation)};
  request.Headers.Add("X-CSRF-Token",csrf);
  using var response=await http.SendAsync(request,cancellation);
  if(response.StatusCode!=HttpStatusCode.Conflict)response.EnsureSuccessStatusCode();
  var result=await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
  return (response.StatusCode==HttpStatusCode.Conflict,result);
 }
 public async Task<JsonElement> IdentityAsync(CancellationToken cancellation=default)
 {
  using var response=await http.GetAsync("api/me",cancellation);response.EnsureSuccessStatusCode();
  var identity=await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
  csrf=identity.GetProperty("csrf").GetString()??throw new InvalidDataException("Missing CSRF token.");
  return identity;
 }
 public async Task<byte[]?> DownloadAssetAsync(string path,CancellationToken cancellation=default)
 {
  LocalFiles.ValidatePortablePath(path);
  using var response=await http.GetAsync("api/attachment?path="+Uri.EscapeDataString(path),HttpCompletionOption.ResponseHeadersRead,cancellation);
  if(response.StatusCode==HttpStatusCode.NotFound)return null;
  response.EnsureSuccessStatusCode();
  if(response.Content.Headers.ContentLength>10_000_000)throw new InvalidDataException("Attachment exceeds 10 MB.");
  using var stream=await response.Content.ReadAsStreamAsync(cancellation);
  using var buffer=new MemoryStream();var chunk=new byte[81920];int count;
  while((count=await stream.ReadAsync(chunk,cancellation))>0)
  {
   if(buffer.Length+count>10_000_000)throw new InvalidDataException("Attachment exceeds 10 MB.");
   buffer.Write(chunk,0,count);
  }
  return buffer.ToArray();
 }
 public async Task UploadAssetAsync(string path,byte[] bytes,CancellationToken cancellation=default)
 {
  LocalFiles.ValidatePortablePath(path);
  if(csrf is null)throw new InvalidOperationException("Sign in before uploading.");
  if(bytes.Length>10_000_000)throw new ArgumentException("Attachment exceeds 10 MB.");
  using var request=new HttpRequestMessage(HttpMethod.Post,"api/attachments?path="+Uri.EscapeDataString(path)){Content=new ByteArrayContent(bytes)};
  request.Content.Headers.ContentType=new("application/octet-stream");
  request.Headers.Add("X-CSRF-Token",csrf);
  using var response=await http.SendAsync(request,cancellation);response.EnsureSuccessStatusCode();
 }
 public async Task<(bool Conflict,JsonElement Result)> UpdateMetadataAsync(LibraryMutation mutation,CancellationToken cancellation=default)
 {
  if(csrf is null)throw new InvalidOperationException("Sign in before synchronizing.");
  _=LibraryRules.Fields(mutation.Collection);if(!Guid.TryParse(mutation.RecordId,out _))throw new ArgumentException("Invalid metadata identity.");
  var method=mutation.Kind switch{"update"=>HttpMethod.Put,"create"=>HttpMethod.Post,"delete" when mutation.Collection is "sources" or "quickActions"=>HttpMethod.Delete,_=>throw new ArgumentException("Unsupported metadata operation.")};
  var route="api/"+LibraryRules.Route(mutation.Collection)+(mutation.Kind=="create"?"":"/"+Uri.EscapeDataString(mutation.RecordId));
  if(mutation.Kind=="delete")route+="?revision="+mutation.Expected.GetProperty("revision").GetInt32();
  using var request=new HttpRequestMessage(method,route){Content=mutation.Kind=="delete"?null:JsonContent.Create(LibraryRules.Payload(mutation))};
  request.Headers.Add("X-CSRF-Token",csrf);using var response=await http.SendAsync(request,cancellation);
  if(response.StatusCode!=HttpStatusCode.Conflict)response.EnsureSuccessStatusCode();
  return(response.StatusCode==HttpStatusCode.Conflict,await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation));
 }
 static async Task<string> ServerError(HttpResponseMessage response,CancellationToken cancellation)
 {
  try
  {
   var body=await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
   if(body.ValueKind==JsonValueKind.Object&&body.TryGetProperty("error",out var error)&&error.ValueKind==JsonValueKind.String)return error.GetString()!;
  }
  catch{}
  return "HTTP "+((int)response.StatusCode).ToString();
 }
 public async Task<JsonElement> ActivateQuickActionAsync(Guid actionId,Guid op,CancellationToken cancellation=default)
 {
  if(csrf is null)throw new InvalidOperationException("Sign in before activating quick actions.");
  using var request=new HttpRequestMessage(HttpMethod.Post,"api/quick-actions/"+Uri.EscapeDataString(actionId.ToString())+"/activate"){Content=JsonContent.Create(JsonSerializer.SerializeToElement(new{op=op.ToString()},SyncWorkspace.Json))};
  request.Headers.Add("X-CSRF-Token",csrf);using var response=await http.SendAsync(request,cancellation);
  if(!response.IsSuccessStatusCode)
  {
   var message=await ServerError(response,cancellation);
   // Deterministic server rejections surface their hosted reason; transient failures keep the retained op.
   if(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound or HttpStatusCode.Gone or HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity)throw new InvalidOperationException(message);
   response.EnsureSuccessStatusCode();
  }
  return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
 }
 public async Task<(bool Conflict,JsonElement Result)> ReorderQuickActionsAsync(string[] ids,string[] expected,CancellationToken cancellation=default)
 {
  if(csrf is null)throw new InvalidOperationException("Sign in before synchronizing quick actions.");
  using var request=new HttpRequestMessage(HttpMethod.Put,"api/quick-actions/order"){Content=JsonContent.Create(JsonSerializer.SerializeToElement(new{ids,expected},SyncWorkspace.Json))};
  request.Headers.Add("X-CSRF-Token",csrf);using var response=await http.SendAsync(request,cancellation);
  if(response.StatusCode!=HttpStatusCode.Conflict)response.EnsureSuccessStatusCode();
  return(response.StatusCode==HttpStatusCode.Conflict,await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation));
 }
 public async Task<JsonElement> PutStyleAsync(string path,string content,CancellationToken cancellation=default)
 {
  if(csrf is null)throw new InvalidOperationException("Sign in before synchronizing styles.");
  LocalFiles.ValidatePortablePath(path);
  using var request=new HttpRequestMessage(HttpMethod.Put,"api/styles"){Content=JsonContent.Create(JsonSerializer.SerializeToElement(new{path,content},SyncWorkspace.Json))};
  request.Headers.Add("X-CSRF-Token",csrf);using var response=await http.SendAsync(request,cancellation);
  response.EnsureSuccessStatusCode();
  return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
 }
 public async Task<bool> MutateFolderAsync(FolderMutation mutation,CancellationToken cancellation=default)
 {
  LocalFiles.ValidatePortablePath(mutation.Path);if(csrf is null)throw new InvalidOperationException("Sign in before synchronizing folders.");
  var payload=mutation.Delete?JsonSerializer.SerializeToElement(new{path=mutation.Path,mode="empty"}):JsonSerializer.SerializeToElement(new{path=mutation.Path});
  using var request=new HttpRequestMessage(mutation.Delete?HttpMethod.Delete:HttpMethod.Post,"api/folders"){Content=JsonContent.Create(payload)};
  request.Headers.Add("X-CSRF-Token",csrf);using var response=await http.SendAsync(request,cancellation);
  if(response.StatusCode==HttpStatusCode.Conflict||mutation.Delete&&response.StatusCode==HttpStatusCode.NotFound)return false;
  response.EnsureSuccessStatusCode();var result=await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:cancellation);
  if(mutation.Delete?result.GetProperty("moved").GetInt32()!=0||result.GetProperty("destination").ValueKind!=JsonValueKind.Null:result.GetProperty("path").GetString()!=mutation.Path)throw new InvalidDataException("Invalid folder acknowledgement; operation retained.");
  return true;
 }
 public void Dispose()=>http.Dispose();
}
