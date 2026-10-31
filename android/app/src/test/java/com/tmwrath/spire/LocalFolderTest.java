package com.tmwrath.spire;

import android.content.Context;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsProvider;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowContentResolver;
import java.io.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class LocalFolderTest {
 public static class Provider extends android.content.ContentProvider {
  static final String AUTH="com.tmwrath.spire.test.documents";
  byte[] mediaPayload;
  int writingQueries=0;
  int mediaReads=0,textReads=0,readAttempts=0,transientReadFailures=0,nullQueries=0;long textModified=1L;String textContent="hello";boolean missingChild=false,missingFile=false;
  public boolean onCreate(){return true;}
  public Cursor query(Uri uri,String[] p,String selection,String[] args,String sort){String id=DocumentsContract.getDocumentId(uri);return uri.getLastPathSegment().equals("children")?queryChildDocuments(id,p,sort):queryDocument(id,p);}
  public String getType(Uri uri){return "application/octet-stream";}
  public Uri insert(Uri u,android.content.ContentValues v){throw new UnsupportedOperationException();}
  public int update(Uri u,android.content.ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
  public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
  public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{return openDocument(DocumentsContract.getDocumentId(uri),mode,null);}
  public Cursor queryRoots(String[] p){return new MatrixCursor(new String[]{"root_id"});}
  MatrixCursor rows(String[] projection,String... ids){
   String[] cols=projection==null?new String[]{"document_id","_display_name","mime_type","flags","_size","last_modified"}:projection;
   MatrixCursor c=new MatrixCursor(cols);
   for(String id:ids){Object[] row=new Object[cols.length];boolean dir=id.equals("root")||id.equals("Writing")||id.equals("Gone");
    for(int i=0;i<cols.length;i++)switch(cols[i]){
     case "document_id":row[i]=id;break;
     case "_display_name":row[i]=id;break;
     case "mime_type":row[i]=dir?DocumentsContract.Document.MIME_TYPE_DIR:"application/octet-stream";break;
     case "flags":row[i]=dir?DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE:DocumentsContract.Document.FLAG_SUPPORTS_WRITE;break;
     case "_size":row[i]=id.endsWith("mp4")?(mediaPayload==null?8000000000L:mediaPayload.length):id.equals("a.md")?textContent.getBytes(java.nio.charset.StandardCharsets.UTF_8).length:5L;break;
     case "last_modified":row[i]=id.equals("a.md")?textModified:1L;break;
    }c.addRow(row);
   }return c;
  }
  public Cursor queryDocument(String id,String[] p){return rows(p,id);}
  public Cursor queryChildDocuments(String id,String[] p,String sort){if(id.equals("Writing"))writingQueries++;if(id.equals("Writing")&&nullQueries>0){nullQueries--;return null;}if(missingChild&&id.equals("Gone"))throw new SecurityException("revoked child");if(missingChild&&id.equals("root"))return rows(p,"Gone","Writing");return rows(p,id.equals("root")?new String[]{"Writing"}:id.equals("Writing")?new String[]{"a.md","large.mp4"}:new String[0]);}
  public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{
   if(id.equals("a.md")){readAttempts++;if(transientReadFailures>0){transientReadFailures--;throw new FileNotFoundException("provider warming up");}}
   if(missingFile&&id.equals("a.md"))throw new FileNotFoundException("moved file");
   if(id.endsWith("mp4")&&mediaPayload!=null){mediaReads++;try{File media=File.createTempFile("video", ".mp4",getContext().getCacheDir());try(FileOutputStream out=new FileOutputStream(media)){out.write(mediaPayload);}return ParcelFileDescriptor.open(media,ParcelFileDescriptor.MODE_READ_ONLY);}catch(IOException e){throw new FileNotFoundException(e.toString());}}
   if(id.endsWith("mp4")){mediaReads++;throw new AssertionError("Opening media blocks the provider: must stay lazy");}
   textReads++;try{File file=File.createTempFile("spire", ".md",getContext().getCacheDir());try(FileOutputStream out=new FileOutputStream(file)){out.write(textContent.getBytes(java.nio.charset.StandardCharsets.UTF_8));}return ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);}catch(IOException e){throw new FileNotFoundException(e.toString());}
  }
 }
 @Test public void browsingListsOnlyOneDirectoryAndNeverReadsBodies()throws Exception{
  LocalFolder folder=folder();JSONObject root=folder.openDirectory();
  assertEquals(0,provider.writingQueries);assertEquals(0,provider.textReads);assertEquals(0,provider.mediaReads);
  assertEquals("Writing",root.getJSONArray("dirs").getString(0));assertFalse(root.getJSONObject("files").has("Writing/a.md"));
  JSONObject child=folder.listDirectory("Writing");assertEquals(1,provider.writingQueries);
  assertTrue(child.getJSONObject("files").get("Writing/a.md") instanceof JSONObject);
  assertTrue(child.getJSONObject("files").get("Writing/large.mp4") instanceof JSONObject);
  assertEquals(0,provider.textReads);assertEquals(0,provider.mediaReads);
  folder.readText("Writing/a.md");assertEquals(1,provider.textReads);assertEquals(0,provider.mediaReads);
 }
 Provider provider;
 LocalFolder folder()throws Exception{
  Context c=new android.content.ContextWrapper(RuntimeEnvironment.getApplication()){
   @Override public Context getApplicationContext(){return this;}
   @Override public int checkCallingOrSelfUriPermission(Uri uri,int flags){return android.content.pm.PackageManager.PERMISSION_GRANTED;}
  };provider=new Provider();ProviderInfo info=new ProviderInfo();info.authority=Provider.AUTH;info.exported=true;info.grantUriPermissions=true;info.readPermission=info.writePermission="android.permission.MANAGE_DOCUMENTS";provider.attachInfo(c,info);ShadowContentResolver.registerProviderInternal(Provider.AUTH,provider);
  Uri tree=DocumentsContract.buildTreeDocumentUri(Provider.AUTH,"root");androidx.documentfile.provider.DocumentFile doc=androidx.documentfile.provider.DocumentFile.fromTreeUri(c,tree);
  try(Cursor probe=c.getContentResolver().query(doc.getUri(),new String[]{"mime_type"},null,null,null)){assertNotNull(probe);assertTrue(probe.moveToFirst());}
  assertTrue("directory type="+doc.getType(),doc.isDirectory());assertTrue("read permission",doc.canRead());assertTrue("write permission",doc.canWrite());
  return new LocalFolder(c,tree);
 }
 @Test public void nativeVideoResponseSupportsFullAndLateRangePlayback()throws Exception{
  LocalFolder f=folder();provider.mediaPayload=new byte[2_000_003];new java.util.Random(18).nextBytes(provider.mediaPayload);
  Uri url=Uri.parse(f.origin+"/api/attachment?path=Writing%2Flarge.mp4");
  android.webkit.WebResourceResponse full=f.resource(url);
  assertEquals(200,full.getStatusCode());assertEquals("video/mp4",full.getMimeType());assertEquals("2000003",full.getResponseHeaders().get("Content-Length"));
  try(InputStream in=full.getData()){assertArrayEquals(provider.mediaPayload,in.readAllBytes());}
  android.webkit.WebResourceResponse tail=f.resource(url,"bytes=1900000-");assertEquals(206,tail.getStatusCode());assertEquals("bytes 1900000-2000002/2000003",tail.getResponseHeaders().get("Content-Range"));
  try(InputStream in=tail.getData()){assertArrayEquals(java.util.Arrays.copyOfRange(provider.mediaPayload,1900000,2000003),in.readAllBytes());}
  int reads=provider.mediaReads;assertEquals(416,f.resource(url,"bytes=9999999-").getStatusCode());assertEquals(reads,provider.mediaReads);
 }
 @Test public void manualStartupLeavesLegacyJournalByteIdentical()throws Exception{
  LocalFolder f=folder();JSONObject tree=f.load();int reads=provider.textReads;
  java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("journal");field.setAccessible(true);
  android.util.AtomicFile journal=(android.util.AtomicFile)field.get(f);
  byte[] data=new JSONObject().put("before",tree).put("after",new JSONObject(tree.toString())).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  try(FileOutputStream out=new FileOutputStream(journal.getBaseFile())){out.write(data);}
  JSONObject loaded=f.load();assertEquals(reads,provider.textReads);assertTrue(journal.getBaseFile().exists());
  assertArrayEquals(data,journal.readFully());assertTrue(loaded.getJSONObject("files").has("Writing/a.md"));
 }
 @Test public void explicitRecoveryPreservesFullJournalBackup()throws Exception{
  LocalFolder f=folder();JSONObject tree=f.load();java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("journal");field.setAccessible(true);android.util.AtomicFile journal=(android.util.AtomicFile)field.get(f);
  byte[] bytes=new JSONObject().put("before",tree).put("after",new JSONObject(tree.toString())).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  try(FileOutputStream out=new FileOutputStream(journal.getBaseFile())){out.write(bytes);}
  assertNotNull(f.recoveryDescription());assertTrue(journal.getBaseFile().exists());f.finishRecovery();assertFalse(journal.getBaseFile().exists());
  File[] copies=journal.getBaseFile().getParentFile().listFiles((d,n)->n.startsWith(journal.getBaseFile().getName()+".recovered-"));assertNotNull(copies);boolean retained=false;for(File copy:copies)if(java.util.Arrays.equals(bytes,java.nio.file.Files.readAllBytes(copy.toPath())))retained=true;assertTrue(retained);
 }
 @Test public void explicitRecoveryRejectsExternalBytesAndKeepsJournal()throws Exception{
  LocalFolder f=folder();JSONObject current=f.load(),before=new JSONObject(current.toString()),after=new JSONObject(current.toString());before.getJSONObject("files").put("Writing/a.md","b2xk");after.getJSONObject("files").put("Writing/a.md","bmV3");
  java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("journal");field.setAccessible(true);android.util.AtomicFile journal=(android.util.AtomicFile)field.get(f);byte[] bytes=new JSONObject().put("before",before).put("after",after).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);try(FileOutputStream out=new FileOutputStream(journal.getBaseFile())){out.write(bytes);}
  assertTrue(f.recoveryDescription().contains("Writing/a.md"));assertThrows(Exception.class,f::finishRecovery);assertArrayEquals(bytes,journal.readFully());
 }
 @Test public void transientProviderReadIsRetriedBeforeWarning()throws Exception{
  LocalFolder f=folder();provider.transientReadFailures=2;JSONObject tree=f.load();assertEquals(0,provider.readAttempts);assertNotNull(f.readText("Writing/a.md"));assertTrue(tree.getJSONObject("files").has("Writing/a.md"));assertEquals(3,provider.readAttempts);assertEquals(0,tree.getJSONArray("warnings").length());assertEquals(0,provider.mediaReads);
 }
 @Test public void temporaryNullEnumerationIsRetried()throws Exception{
  LocalFolder f=folder();provider.nullQueries=2;JSONObject tree=f.load();assertTrue(tree.getJSONObject("files").has("Writing/a.md"));assertEquals(0,tree.getJSONArray("warnings").length());
 }
 @Test public void persistentReadFailureIsBoundedAndClassified()throws Exception{
  LocalFolder f=folder();provider.missingFile=true;JSONObject tree=f.load();assertEquals(0,provider.readAttempts);assertThrows(FileNotFoundException.class,()->f.readText("Writing/a.md"));assertEquals(3,provider.readAttempts);assertTrue(tree.getJSONObject("files").has("Writing/large.mp4"));
 }
 @Test public void permissionFailuresAreNotRetried()throws Exception{
  final int[] calls={0};try{LocalFolder.retryRead(()->{calls[0]++;throw new SecurityException("permission revoked");});fail();}catch(SecurityException expected){assertEquals(1,calls[0]);}
 }
 @Test public void missingChildFolderDoesNotHideHealthySibling()throws Exception{
  LocalFolder f=folder();provider.missingChild=true;JSONObject tree=f.load();assertTrue(tree.getJSONObject("files").has("Writing/a.md"));assertFalse(tree.getJSONArray("dirs").toString().contains("Gone"));assertEquals("Gone",tree.getJSONArray("warnings").getJSONObject(0).getString("path"));
 }
 @Test public void missingFileDoesNotHideSiblingAttachment()throws Exception{
  LocalFolder f=folder();provider.missingFile=true;JSONObject tree=f.load();assertTrue(tree.getJSONObject("files").has("Writing/a.md"));assertThrows(FileNotFoundException.class,()->f.readText("Writing/a.md"));assertTrue(tree.getJSONObject("files").has("Writing/large.mp4"));assertEquals(0,provider.mediaReads);
 }
 @Test public void startupListsLargeAttachmentsWithoutOpeningThem()throws Exception{
  JSONObject tree=folder().load();assertEquals(0,provider.mediaReads);assertEquals(0,provider.textReads);
  assertEquals("saf",tree.getJSONObject("files").getJSONObject("Writing/a.md").getString("kind"));
  assertEquals(8000000000L,tree.getJSONObject("files").getJSONObject("Writing/large.mp4").getLong("size"));
 }
 @Test public void indexedReopenUsesValidatedPrivateCacheWithoutProviderEnumeration()throws Exception{
  LocalFolder f=folder();JSONObject tree=f.load();
  int reads=provider.textReads;provider.nullQueries=99;JSONObject cached=f.openIndexed();
  assertTrue(cached.getJSONObject("files").has("Writing/a.md"));assertTrue(cached.getBoolean("provisional"));assertEquals(reads,provider.textReads);assertEquals(99,provider.nullQueries);
  provider.nullQueries=0;
  f.load();assertEquals(reads,provider.textReads); // refresh enumerates structure, never bodies
 }
 @Test public void indexedReopenDefersNoOpRecoveryInspectionWithoutProviderEnumeration()throws Exception{
  LocalFolder f=folder();JSONObject tree=f.load();java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("journal");field.setAccessible(true);
  android.util.AtomicFile journal=(android.util.AtomicFile)field.get(f);JSONObject after=new JSONObject(tree.toString()).put("warnings",new org.json.JSONArray().put(new JSONObject().put("message","non-durable scan warning")));byte[] data=new JSONObject().put("before",tree).put("after",after).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  try(FileOutputStream out=new FileOutputStream(journal.getBaseFile())){out.write(data);}
  int reads=provider.textReads;JSONObject cached=f.openIndexed();assertTrue(cached.getJSONObject("files").has("Writing/a.md"));assertTrue(cached.getBoolean("provisional"));assertTrue(cached.getBoolean("recoveryPending"));assertEquals(reads,provider.textReads);
  assertArrayEquals(data,journal.readFully());
 }
 @Test public void corruptPrivateIndexFallsBackToAuthoritativeFolderScan()throws Exception{
  LocalFolder f=folder();java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("index");field.setAccessible(true);
  android.util.AtomicFile index=(android.util.AtomicFile)field.get(f);try(FileOutputStream out=new FileOutputStream(index.getBaseFile())){out.write("not json".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
  int reads=provider.textReads;assertTrue(f.openIndexed().getJSONObject("files").has("Writing/a.md"));assertEquals(reads,provider.textReads);
 }
 @Test public void indexedReopenDefersProviderMetadataChangesUntilAuthoritativeRefresh()throws Exception{
  LocalFolder f=folder();f.load();int reads=provider.textReads;provider.textContent="changed";provider.textModified++;
  JSONObject reopened=f.openIndexed();assertEquals(reads,provider.textReads);assertTrue(reopened.getBoolean("provisional"));
  assertEquals("saf",reopened.getJSONObject("files").getJSONObject("Writing/a.md").getString("kind"));
  JSONObject refreshed=f.load();assertEquals(reads,provider.textReads);
  assertEquals("saf",refreshed.getJSONObject("files").getJSONObject("Writing/a.md").getString("kind"));assertEquals("changed",new String(android.util.Base64.decode(f.readText("Writing/a.md"),android.util.Base64.DEFAULT),java.nio.charset.StandardCharsets.UTF_8));assertEquals(reads+1,provider.textReads);
 }
 @Test public void openingOneTextReadsProviderWithoutScanningWorkspace()throws Exception{
  LocalFolder f=folder();f.load();int reads=provider.textReads;
  assertNotNull(f.readText("Writing/a.md"));assertEquals(reads+1,provider.textReads);assertEquals(0,provider.mediaReads);
  provider.missingFile=true;try{f.readText("Writing/a.md");fail("Unavailable text must not fall back to cache");}catch(FileNotFoundException expected){}
 }
 @Test public void indexedReopenNeverReplaysPendingWrites()throws Exception{
  LocalFolder f=folder();JSONObject before=f.load(),after=new JSONObject(before.toString());after.getJSONObject("files").put("Writing/a.md","bmV3");
  java.lang.reflect.Field field=LocalFolder.class.getDeclaredField("journal");field.setAccessible(true);android.util.AtomicFile journal=(android.util.AtomicFile)field.get(f);
  byte[] bytes=new JSONObject().put("before",before).put("after",after).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  try(FileOutputStream out=new FileOutputStream(journal.getBaseFile())){out.write(bytes);}
  int reads=provider.textReads;JSONObject cached=f.openIndexed();assertEquals("saf",cached.getJSONObject("files").getJSONObject("Writing/a.md").getString("kind"));assertTrue(cached.getBoolean("provisional"));assertTrue(cached.getBoolean("recoveryPending"));assertEquals(reads,provider.textReads);
  JSONObject refreshed=f.load();assertTrue(refreshed.getBoolean("recoveryPending"));assertEquals(reads,provider.textReads);
  assertArrayEquals(bytes,journal.readFully());
 }
 @Test public void speechAssetsHaveExecutableJavaScriptAndWasmTypes()throws Exception{
  LocalFolder f=folder();
  String[][] assets={{"/assets/voice.worker-YvJMhjQu.js","application/javascript"},{"/voice/whistle/needle.wasm","application/wasm"}};
  for(String[] asset:assets){
   android.webkit.WebResourceResponse r=f.resource(Uri.parse(f.origin+asset[0]));
   assertEquals(200,r.getStatusCode());
   assertEquals(asset[1],r.getMimeType());
   String csp=r.getResponseHeaders().get("Content-Security-Policy");
   assertTrue(csp.contains("'wasm-unsafe-eval'"));assertFalse(csp.contains("'unsafe-eval'"));
   assertTrue(csp.contains("connect-src 'self'"));
   try(InputStream in=r.getData()){assertTrue(in.read()>=0);}
  }
  assertEquals(404,f.resource(Uri.parse("https://other.invalid/voice/whistle/needle.wasm")).getStatusCode());
 }
 @Test public void bundledEditorAssetsDoNotWaitForTheStorageMonitor()throws Exception{
  LocalFolder f=folder();ExecutorService worker=Executors.newSingleThreadExecutor();
  try{synchronized(f){Future<Integer> result=worker.submit(()->{try(InputStream in=f.resource(Uri.parse(f.origin+"/index.html")).getData()){return in.read();}});assertTrue(result.get(2,TimeUnit.SECONDS)>=0);}}finally{worker.shutdownNow();}
 }
}
