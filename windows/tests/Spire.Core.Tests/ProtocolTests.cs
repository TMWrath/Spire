using Spire.Core;
using System.Net;
using System.Text.Json;

static class ProtocolTests
{
 public static async Task Run()
 {
  var handler=new Handler();using var client=new ServerClient(new Uri("https://spire.invalid/"),handler);
  await client.LoginAsync("user","not-a-real-password","Windows test");
  await client.MutateAsync(JsonSerializer.SerializeToElement(new{op="test"}));
  if(handler.Writes!=2)throw new Exception("Protocol writes not inspected");
  using var assets=new ServerClient(new Uri("https://spire.invalid/"),new AssetHandler());
  await assets.LoginAsync("user","test","test");
  await assets.UploadAssetAsync("Attachments/a b.bin",new byte[]{1,2,3});
  if(!(await assets.DownloadAssetAsync("Attachments/a b.bin"))!.SequenceEqual(new byte[]{1,2,3}))throw new Exception("Binary download changed");
  if(await assets.DownloadAssetAsync("Attachments/missing.bin") is not null)throw new Exception("404 must mean absent");
  var libraryHandler=new LibraryHandler();using var libraryClient=new ServerClient(new Uri("https://spire.invalid/"),libraryHandler);await libraryClient.LoginAsync("user","test","test");
  var tid=Guid.NewGuid().ToString();var before=JsonSerializer.SerializeToElement(new{id=tid,title="Title",category="section",content="old",sourcePath="Writing/A.md",future="preserve"});var after=JsonSerializer.SerializeToElement(new{id=tid,title="Title",category="section",content="new",sourcePath="Writing/A.md",future="preserve"});
  await libraryClient.UpdateMetadataAsync(new(Guid.NewGuid(),"templates",tid,before,after));
  var sourceBefore=JsonSerializer.SerializeToElement(new{id=tid,revision=4,title="Title",kind="book",future="preserve"});
  var result=await libraryClient.UpdateMetadataAsync(new(Guid.NewGuid(),"sources",tid,sourceBefore,sourceBefore));if(!result.Conflict||libraryHandler.Calls!=2)throw new Exception("Metadata CAS conflict was not exposed");
  Console.WriteLine("PASS: metadata PUT routes, whitelist payload, expectedContent/expectedRevision, CSRF and HTTP 409 preservation");
  Console.WriteLine("PASS: HTTP Origin, JSON login, CSRF mutation headers; binary attachment routes, query encoding and missing asset");
 }
 sealed class LibraryHandler:HttpMessageHandler
 {
  public int Calls;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c)
  {
   if(r.Method!=HttpMethod.Put)return new(HttpStatusCode.OK){Content=new StringContent("{\"owner\":\"a\",\"csrf\":\"fake-csrf\"}",System.Text.Encoding.UTF8,"application/json")};
   Calls++;if(r.Headers.GetValues("X-CSRF-Token").Single()!="fake-csrf"||r.Headers.GetValues("Origin").Single()!="https://spire.invalid")throw new Exception("Missing metadata write authentication headers");
   var body=JsonDocument.Parse(await r.Content!.ReadAsStringAsync(c)).RootElement;
   if(body.TryGetProperty("future",out _)||body.TryGetProperty("id",out _))throw new Exception("Strict metadata payload contains record-only fields");
   bool source=r.RequestUri!.AbsolutePath.StartsWith("/api/sources/",StringComparison.Ordinal);
   if(source?body.GetProperty("expectedRevision").GetInt32()!=4:!r.RequestUri.AbsolutePath.StartsWith("/api/templates/",StringComparison.Ordinal)||body.GetProperty("expectedContent").GetString()!="old")throw new Exception("Metadata endpoint or CAS payload incorrect");
   return new(source?HttpStatusCode.Conflict:HttpStatusCode.OK){Content=new StringContent("{}",System.Text.Encoding.UTF8,"application/json")};
  }
 }
 sealed class AssetHandler:HttpMessageHandler
 {
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c)
  {
   var path=r.RequestUri!.AbsolutePath;
   if(path=="/api/login"||path=="/api/me")return new(HttpStatusCode.OK){Content=new StringContent("{\"owner\":\"a\",\"csrf\":\"fake-csrf\"}",System.Text.Encoding.UTF8,"application/json")};
   if(r.RequestUri.Query.Contains("missing.bin"))return new(HttpStatusCode.NotFound);
   if(r.RequestUri.Query!="?path=Attachments%2Fa%20b.bin")throw new Exception("Attachment query encoding incorrect: "+r.RequestUri.Query);
   if(r.Method==HttpMethod.Post)
   {
    if(path!="/api/attachments"||r.Content!.Headers.ContentType!.MediaType!="application/octet-stream"||!r.Headers.GetValues("X-CSRF-Token").Contains("fake-csrf"))throw new Exception("Wrong binary upload protocol");
    if(!(await r.Content.ReadAsByteArrayAsync(c)).SequenceEqual(new byte[]{1,2,3}))throw new Exception("Upload bytes changed");
    return new(HttpStatusCode.OK);
   }
   if(path!="/api/attachment")throw new Exception("Wrong download route");
   return new(HttpStatusCode.OK){Content=new ByteArrayContent(new byte[]{1,2,3})};
  }
 }
 sealed class Handler:HttpMessageHandler
 {
  public int Writes;
  protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c)
  {
   if(r.Method!=HttpMethod.Get)
   {
    Writes++;
    if(!r.Headers.TryGetValues("Origin",out var origins)||origins.Single()!="https://spire.invalid")throw new Exception("Required Origin header missing");
    if(r.RequestUri!.AbsolutePath=="/api/mutate"&&(!r.Headers.TryGetValues("X-CSRF-Token",out var tokens)||tokens.Single()!="fake-csrf"))throw new Exception("CSRF header missing");
   }
   return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent("{\"owner\":\"a\",\"csrf\":\"fake-csrf\"}",System.Text.Encoding.UTF8,"application/json")});
  }
 }
}
