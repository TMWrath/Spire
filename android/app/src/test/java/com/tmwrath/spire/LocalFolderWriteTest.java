package com.tmwrath.spire;

import android.content.*;
import android.content.pm.ProviderInfo;
import android.database.*;
import android.net.Uri;
import android.os.*;
import android.provider.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowContentResolver;
import java.io.*;
import java.nio.file.Files;
import static org.junit.Assert.*;

/** Exercises real DocumentFile/ContentResolver calls against a writable test provider. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class LocalFolderWriteTest {
 public static class Provider extends ContentProvider {
  static final String AUTH="com.tmwrath.spire.manualtest";
  File root;boolean failWrite,failInstall;int renames,queries,documentQueries,readOpens,childRows;
  public boolean onCreate(){return true;}
  public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){queries++;String id=DocumentsContract.getDocumentId(uri);if(uri.getLastPathSegment().equals("children"))return queryChildDocuments(id,projection,sort);documentQueries++;return queryDocument(id,projection);}
  public String getType(Uri uri){return file(DocumentsContract.getDocumentId(uri)).isDirectory()?DocumentsContract.Document.MIME_TYPE_DIR:"application/octet-stream";}
  public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
  public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
  public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
  public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{return openDocument(DocumentsContract.getDocumentId(uri),mode,null);}
  public Bundle call(String method,String arg,Bundle extras){
   try{Uri uri=extras.getParcelable("uri");String id=DocumentsContract.getDocumentId(uri),result=null;Bundle reply=new Bundle();
    if(method.endsWith("createDocument"))result=createDocument(id,extras.getString("mime_type"),extras.getString("_display_name"));
    else if(method.endsWith("renameDocument"))result=renameDocument(id,extras.getString("_display_name"));
    else if(method.endsWith("deleteDocument"))deleteDocument(id);
    else throw new UnsupportedOperationException(method);
    if(result!=null)reply.putParcelable("uri",DocumentsContract.buildDocumentUriUsingTree(uri,result));return reply;
   }catch(FileNotFoundException e){throw new IllegalArgumentException(e);}
  }
  File file(String id){return id.equals("root")?root:new File(root,id.substring(5));}
  String id(File f){return f.equals(root)?"root":"root/"+root.toPath().relativize(f.toPath()).toString();}
  public Cursor queryRoots(String[] projection){return new MatrixCursor(new String[]{"root_id"});}
  MatrixCursor rows(String[] projection,File[] files){
   String[] cols=projection==null?new String[]{"document_id","_display_name","mime_type","flags","_size","last_modified"}:projection;
   MatrixCursor c=new MatrixCursor(cols);
   for(File f:files){if(!f.exists())continue;Object[] row=new Object[cols.length];for(int i=0;i<cols.length;i++)switch(cols[i]){
    case "document_id":row[i]=id(f);break;
    case "_display_name":row[i]=f.getName();break;
    case "mime_type":row[i]=f.isDirectory()?DocumentsContract.Document.MIME_TYPE_DIR:"application/octet-stream";break;
    case "flags":row[i]=f.isDirectory()?DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE:DocumentsContract.Document.FLAG_SUPPORTS_WRITE|DocumentsContract.Document.FLAG_SUPPORTS_RENAME|DocumentsContract.Document.FLAG_SUPPORTS_DELETE;break;
    case "_size":row[i]=f.length();break;
    case "last_modified":row[i]=f.lastModified();break;
   }c.addRow(row);}return c;
  }
  public Cursor queryDocument(String id,String[] projection){return rows(projection,new File[]{file(id)});}
  public Cursor queryChildDocuments(String id,String[] projection,String sort){File[] files=file(id).listFiles();File[] visible=files==null?new File[0]:files;childRows+=visible.length;return rows(projection,visible);}
  public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{
   if(failWrite&&mode.contains("w"))throw new FileNotFoundException("injected write failure");if(!mode.contains("w"))readOpens++;return ParcelFileDescriptor.open(file(id),ParcelFileDescriptor.parseMode(mode));
  }
  public String createDocument(String parent,String mime,String name)throws FileNotFoundException{
   File f=new File(file(parent),name);try{boolean ok=mime.equals(DocumentsContract.Document.MIME_TYPE_DIR)?f.mkdir():f.createNewFile();if(!ok)throw new IOException("exists");return id(f);}catch(IOException e){throw new FileNotFoundException(e.getMessage());}
  }
  public String renameDocument(String id,String name)throws FileNotFoundException{
   File old=file(id);if(failInstall&&old.getName().startsWith(".spire-write-")&&!name.startsWith("."))throw new FileNotFoundException("injected install failure");
   File next=new File(old.getParentFile(),name);if(next.exists()||!old.renameTo(next))throw new FileNotFoundException("rename failed");renames++;return id(next);
  }
  public void deleteDocument(String id)throws FileNotFoundException{if(!file(id).delete())throw new FileNotFoundException("delete failed");}
  public boolean isChildDocument(String parent,String child){return child.startsWith(parent+"/");}
 }
 Provider provider;LocalFolder folder;File root;
 @Before public void setup()throws Exception{
  Context c=new ContextWrapper(RuntimeEnvironment.getApplication()){
   public Context getApplicationContext(){return this;}
   public int checkCallingOrSelfUriPermission(Uri u,int flags){return android.content.pm.PackageManager.PERMISSION_GRANTED;}
  };
  root=Files.createTempDirectory(c.getCacheDir().toPath(),"manual-write-").toFile();new File(root,"Writing").mkdir();Files.write(new File(root,"Writing/a.md").toPath(),"original".getBytes(java.nio.charset.StandardCharsets.UTF_8));
  provider=new Provider();provider.root=root;ProviderInfo info=new ProviderInfo();info.authority=Provider.AUTH;info.exported=true;info.grantUriPermissions=true;info.readPermission=info.writePermission="android.permission.MANAGE_DOCUMENTS";
  provider.attachInfo(c,info);ShadowContentResolver.registerProviderInternal(Provider.AUTH,provider);
  folder=new LocalFolder(c,DocumentsContract.buildTreeDocumentUri(Provider.AUTH,"root"));
 }
 @Test public void indexedRestartUsesProviderMetadataNotStaleStartupGeneration()throws Exception{
  File metadata=new File(root,".spire-android");metadata.mkdir();
  String old=".spire-android/notes-07-396.json",latest=".spire-android/notes-07-399.json";
  Files.write(new File(root,old).toPath(),"{\"version\":1,\"notes\":{}}".getBytes());
  org.json.JSONObject state=new org.json.JSONObject("{\"seq\":396,\"notes\":{\"n\":{\"path\":\"Writing/a.md\",\"bucketPath\":\""+old+"\"}}}");
  Files.write(new File(metadata,"state.json").toPath(),state.toString().getBytes());
  folder.load(); // Cache the old generation, just as before app-owned saves.
  state.put("seq",399);state.getJSONObject("notes").getJSONObject("n").put("bucketPath",latest);
  Files.write(new File(root,latest).toPath(),"{\"version\":1,\"notes\":{\"n\":{\"path\":\"Writing/a.md\",\"content\":\"latest saved writing\"}}}".getBytes());
  Files.write(new File(metadata,"state.json").toPath(),state.toString().getBytes());
  provider.readOpens=0;
  org.json.JSONObject opened=folder.openIndexed(),files=opened.getJSONObject("files");
  org.json.JSONObject actual=new org.json.JSONObject(new String(android.util.Base64.decode(files.getString(".spire-android/state.json"),android.util.Base64.NO_WRAP)));
  assertEquals(399,actual.getInt("seq"));assertTrue(files.has(latest));assertEquals("saf",files.getJSONObject(latest).getString("kind"));
  assertEquals("saf",files.getJSONObject("Writing/a.md").getString("kind"));assertEquals("original",new String(android.util.Base64.decode(folder.readText("Writing/a.md"),android.util.Base64.NO_WRAP)));
  assertTrue("Refresh only the authoritative index/buckets, not every note",provider.readOpens<=4);
  assertEquals("Startup must remain read-only",state.toString(),new String(Files.readAllBytes(new File(metadata,"state.json").toPath())));
 }
 @Test public void pathLookupDoesNotQueryEverySibling()throws Exception{
  for(int i=0;i<300;i++)new File(root,"sibling-"+i).mkdir();
  provider.queries=0;folder.mkdir("NewFolder");
  assertTrue("mkdir provider queries="+provider.queries,provider.queries<12);
  provider.queries=0;assertNotNull(folder.readText("Writing/a.md"));
  assertTrue("read provider queries="+provider.queries,provider.queries<12);
  provider.queries=0;folder.deleteEmptyDirectory("NewFolder");
  assertTrue("delete provider queries="+provider.queries,provider.queries<12);
 }
 @Test public void largeFolderCreateAndMoveKeepBoundedQueriesAndBytes()throws Exception{
  for(int i=0;i<300;i++)new File(root,"sibling-"+i).mkdir();
  org.json.JSONObject before=folder.load(),created=new org.json.JSONObject(before.toString());
  created.getJSONArray("dirs").put("New/Nested").put("New");
  created.getJSONObject("files").put("New/Nested/new.md",android.util.Base64.encodeToString("new".getBytes(),android.util.Base64.NO_WRAP));
  provider.queries=0;folder.commit(before,created);
  assertTrue("create queries="+provider.queries,provider.queries<100);
  assertEquals("new",new String(Files.readAllBytes(new File(root,"New/Nested/new.md").toPath())));
  org.json.JSONObject moved=new org.json.JSONObject(created.toString());
  moved.getJSONObject("files").put("New/Nested/moved.md",moved.getJSONObject("files").remove("Writing/a.md"));
  provider.queries=0;folder.commit(created,moved);
  assertTrue("move queries="+provider.queries,provider.queries<100);
  assertFalse(new File(root,"Writing/a.md").exists());
  assertEquals("original",new String(Files.readAllBytes(new File(root,"New/Nested/moved.md").toPath())));
 }
 @Test public void stagedSaveReplacesExactNameAndRemovesTemporaryFiles()throws Exception{
  folder.write("Writing/a.md","edited 🌞".getBytes(java.nio.charset.StandardCharsets.UTF_8));
  assertEquals("edited 🌞",new String(Files.readAllBytes(new File(root,"Writing/a.md").toPath()),java.nio.charset.StandardCharsets.UTF_8));assertArrayEquals(new String[]{"a.md"},new File(root,"Writing").list());assertEquals(2,provider.renames);
 }
 @Test public void newFileWritesAndVerifiesItsFinalNameWithoutProviderRename()throws Exception{
  folder.write("Writing/new.md","new".getBytes(java.nio.charset.StandardCharsets.UTF_8));
  assertEquals("new",new String(Files.readAllBytes(new File(root,"Writing/new.md").toPath()),java.nio.charset.StandardCharsets.UTF_8));
  assertEquals("A collision-free new file must not pay for a temporary-name install rename",0,provider.renames);
 }
 @Test public void failedNewFileWriteRemovesIncompleteFinalName()throws Exception{
  provider.failWrite=true;assertThrows(Exception.class,()->folder.write("Writing/new.md","new".getBytes()));
  assertFalse(new File(root,"Writing/new.md").exists());
  assertArrayEquals(new String[]{"a.md"},new File(root,"Writing").list());
 }
 @Test public void failedStageNeverTruncatesOriginal()throws Exception{
  provider.failWrite=true;assertThrows(Exception.class,()->folder.write("Writing/a.md","edited".getBytes()));
  assertEquals("original",new String(Files.readAllBytes(new File(root,"Writing/a.md").toPath()),java.nio.charset.StandardCharsets.UTF_8));assertArrayEquals(new String[]{"a.md"},new File(root,"Writing").list());
 }
 @Test public void failedInstallRestoresOriginalNameAndBytes()throws Exception{
  provider.failInstall=true;assertThrows(Exception.class,()->folder.write("Writing/a.md","edited".getBytes()));
  assertEquals("original",new String(Files.readAllBytes(new File(root,"Writing/a.md").toPath()),java.nio.charset.StandardCharsets.UTF_8));assertArrayEquals(new String[]{"a.md"},new File(root,"Writing").list());
 }
 @Test public void directCommitPersistsWithoutJournal()throws Exception{
   org.json.JSONObject before=folder.load(),after=new org.json.JSONObject(before.toString());after.getJSONObject("files").put("Writing/a.md",android.util.Base64.encodeToString("saved".getBytes(),android.util.Base64.NO_WRAP));
  before.getJSONObject("files").put("Writing/a.md",folder.readText("Writing/a.md"));provider.readOpens=0;folder.commit(before,after);assertEquals("saved",new String(Files.readAllBytes(new File(root,"Writing/a.md").toPath()),java.nio.charset.StandardCharsets.UTF_8));assertNull(folder.recoveryDescription());
  assertEquals("stale-source checks plus one staged readback; no duplicate installed-file reads",3,provider.readOpens);
 }
 @Test public void largeSiblingFolderIsEnumeratedOnceBeforeSaveSideEffects()throws Exception{
  for(int i=0;i<300;i++)Files.write(new File(root,"Writing/sibling-"+i+".md").toPath(),("s"+i).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  org.json.JSONObject before=folder.load(),after=new org.json.JSONObject(before.toString());after.getJSONObject("files").put("Writing/a.md",android.util.Base64.encodeToString("saved".getBytes(),android.util.Base64.NO_WRAP));
  before.getJSONObject("files").put("Writing/a.md",folder.readText("Writing/a.md"));provider.childRows=provider.documentQueries=0;folder.commit(before,after);
  assertTrue("save repeatedly enumerated sibling rows="+provider.childRows,provider.childRows<700);
  assertTrue("save repeated document metadata queries="+provider.documentQueries,provider.documentQueries<3);
 }
 @Test public void indexedReopenDoesNotReopenHundredsOfUnchangedMarkdownFiles()throws Exception{
  for(int i=0;i<300;i++)Files.write(new File(root,"Writing/sibling-"+i+".md").toPath(),("s"+i).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  folder.load();provider.readOpens=0;org.json.JSONObject reopened=folder.openIndexed();
  assertEquals(301,reopened.getJSONObject("files").length());
  assertEquals("unchanged Markdown should come from the validated private startup index",0,provider.readOpens);
 }
 @Test public void materializedAttachmentIsNotRereadByLaterSnapshots()throws Exception{
  Files.write(new File(root,"media.bin").toPath(),new byte[]{1,2,3,4});
  org.json.JSONObject before=folder.load(),moved=new org.json.JSONObject(before.toString());
  moved.getJSONObject("files").put("moved.bin",moved.getJSONObject("files").remove("media.bin"));
  folder.commit(before,moved);
  org.json.JSONObject snapshot=folder.snapshot();
  assertTrue("later scans must keep moved binary media opaque",snapshot.getJSONObject("files").get("moved.bin") instanceof org.json.JSONObject);
 }
}
