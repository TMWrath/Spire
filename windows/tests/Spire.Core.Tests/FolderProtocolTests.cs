using System.Net;
using System.Text.Json;
using Spire.Core;
static class FolderProtocolTests
{
 public static async Task Run()
 {
  var handler=new Handler();using var client=new ServerClient(new Uri("https://spire.invalid/"),handler);
  await client.LoginAsync("test","test","test");
  if(!await client.MutateFolderAsync(new(Guid.NewGuid(),"Writing/Empty",false))||!await client.MutateFolderAsync(new(Guid.NewGuid(),"Writing/Empty",true)))throw new Exception("Folder acknowledgement lost");
  if(await client.MutateFolderAsync(new(Guid.NewGuid(),"Occupied",true))||handler.Writes!=3)throw new Exception("Folder 409 not exposed");
  Console.WriteLine("PASS: exact folder POST/DELETE empty-mode JSON contract, Origin/CSRF headers, acknowledged paths and HTTP 409");
 }
 sealed class Handler:HttpMessageHandler
 {
  public int Writes;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c)
  {
   if(r.RequestUri!.AbsolutePath is "/api/login" or "/api/me")return Reply(HttpStatusCode.OK,"{\"owner\":\"a\",\"csrf\":\"fake\"}");
   if(r.RequestUri.AbsolutePath!="/api/folders"||r.Headers.GetValues("Origin").Single()!="https://spire.invalid"||r.Headers.GetValues("X-CSRF-Token").Single()!="fake")throw new Exception("Wrong folder route/authentication");
   Writes++;using var body=JsonDocument.Parse(await r.Content!.ReadAsStringAsync(c));var path=body.RootElement.GetProperty("path").GetString();
   if(r.Method==HttpMethod.Post){if(body.RootElement.EnumerateObject().Count()!=1)throw new Exception("Folder POST payload not whitelisted");return Reply(HttpStatusCode.Created,"{\"path\":\"Writing/Empty\"}");}
   if(r.Method!=HttpMethod.Delete||body.RootElement.GetProperty("mode").GetString()!="empty"||body.RootElement.EnumerateObject().Count()!=2)throw new Exception("Unsafe folder DELETE mode");
   return path=="Occupied"?Reply(HttpStatusCode.Conflict,"{}"):Reply(HttpStatusCode.OK,"{\"moved\":0,\"destination\":null}");
  }
  static HttpResponseMessage Reply(HttpStatusCode code,string json)=>new(code){Content=new StringContent(json,System.Text.Encoding.UTF8,"application/json")};
 }
}
