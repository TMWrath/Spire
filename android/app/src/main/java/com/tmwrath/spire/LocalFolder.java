package com.tmwrath.spire;
import android.content.Context;
import android.net.Uri;
import android.database.Cursor;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.util.AtomicFile;
import android.util.Base64;
import android.webkit.WebResourceResponse;
import androidx.documentfile.provider.DocumentFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Real SAF-backed folder access. No web-origin gets a filesystem path or arbitrary URI. */
final class LocalFolder implements FolderTransaction.Backend {
 private static final Map<String,LocalFolder> OPEN=new HashMap<>();
 static synchronized LocalFolder open(Context context,Uri tree)throws Exception{String key=tree.toString();LocalFolder folder=OPEN.get(key);if(folder==null){folder=new LocalFolder(context,tree);OPEN.put(key,folder);}return folder;}
 private String selectedTree;
 String treeUri(){return selectedTree;}
 static void mediaPath(String path)throws Exception{FolderTransaction.path(path);if(path.startsWith(".")||text(path))throw new IOException("Not an attachment path");}
 synchronized JSONObject attachmentReference(String path)throws Exception{mediaPath(path);DocumentFile file=resolve(path,false);if(file==null||!file.isFile())throw new IOException("Saved attachment unavailable");return reference(file);}
 synchronized byte[] mediaBytes(String path)throws Exception{mediaPath(path);DocumentFile d=resolve(path,false);if(d==null)return null;if(!d.isFile())throw new IOException("Folder occupies attachment path");return read(context.getContentResolver().openInputStream(d.getUri()),32*1024*1024);}
 synchronized void saveMedia(String path,byte[] bytes,String expected)throws Exception{mediaPath(path);if(!MediaTransfer.hash(mediaBytes(path)).equals(expected))throw new IOException("Local attachment changed; both copies retained");writeVerified(path,bytes,null);}

 private final Context context;private final DocumentFile root;private final AtomicFile journal;private final AtomicFile index;final String origin;
 private final Set<String> materialized=new HashSet<>();
 private Map<String,DocumentFile> operationResolved;
 private Map<String,Boolean> operationDirectories;
 private JSONArray scanWarnings=new JSONArray();
 private JSONObject indexedFiles,indexedStamps,scanStamps;
 LocalFolder(Context c,Uri tree)throws Exception{
  selectedTree=tree.toString();context=c.getApplicationContext();root=DocumentFile.fromTreeUri(context,tree);if(root==null||!root.isDirectory()||!root.canRead()||!root.canWrite())throw new Exception("Folder permission unavailable. Select the folder again.");
  byte[] digest=MessageDigest.getInstance("SHA-256").digest(tree.toString().getBytes(StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte b:digest)hex.append(String.format(Locale.ROOT,"%02x",b));
  origin="https://w-"+hex.substring(0,40)+".spire.invalid";
  File dir=new File(context.getFilesDir(),"folder-journals");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Recovery directory unavailable");journal=new AtomicFile(new File(dir,hex+".json"));
  File indexes=new File(context.getFilesDir(),"folder-indexes");if(!indexes.isDirectory()&&!indexes.mkdirs())throw new IOException("Workspace index unavailable");index=new AtomicFile(new File(indexes,hex+".json"));
 }
 JSONObject location()throws Exception{
  return new JSONObject().put("directory",displayDirectory(root.getUri(),root.getName())).put("base","");
 }
 static String displayDirectory(Uri uri,String name){
  String id=DocumentsContract.getTreeDocumentId(uri);
  String directory;
  if("com.android.externalstorage.documents".equals(uri.getAuthority())){
   int colon=id.indexOf(':');String volume=colon<0?id:id.substring(0,colon),relative=colon<0?"":id.substring(colon+1);
   directory=("primary".equals(volume)?android.os.Environment.getExternalStorageDirectory().getAbsolutePath():"/storage/"+volume)+(relative.isEmpty()?"":"/"+relative);
  }else{
   // Cloud/custom providers do not necessarily have a filesystem directory.
   directory=(name==null?"Selected folder":name)+" ("+uri.getAuthority()+": "+id+")";
  }
  return directory;
 }
 // The app-private index is only a startup view. Every commit still performs
 // fresh provider reads and the complete existing external-change checks.
 synchronized JSONObject openIndexed()throws Exception{
  // Presence is enough for startup. Never parse a potentially large recovery
  // journal before first paint; the runtime keeps all mutations fail-closed.
  boolean recoveryPending=journal.getBaseFile().exists()||new File(journal.getBaseFile().getPath()+".bak").exists();
  try{
   JSONObject cached=new JSONObject(new String(index.readFully(),StandardCharsets.UTF_8));
   if(cached.optInt("version")!=1)throw new IOException("Unsupported workspace index");
   JSONObject tree=cached.getJSONObject("tree");FolderTransaction.validate(tree);
   refreshIndexedMetadata(tree);
   // First paint must not wait for a complete SAF walk. The runtime treats this
   // validated app-private tree as read-only until load() reconciles the provider.
   JSONObject opened=new JSONObject(tree.toString()).put("provisional",true);if(recoveryPending)opened.put("recoveryPending",true);return opened;
  }catch(Exception unavailable){return load();}
 }
 // Manual Local reads ordinary files on open, but its revision namespace must
 // come from the provider before the first mutation. The startup cache is not
 // updated by every incremental commit and may be several generations behind.
 // Reusing that sequence can collide with our own already-written bucket and
 // falsely report an outside edit. Refresh only the index and referenced buckets;
 // keep startup read-only and avoid a whole-folder/attachment scan.
 private void refreshIndexedMetadata(JSONObject tree)throws Exception{
  final String path=".spire-android/state.json";
  JSONObject files=tree.getJSONObject("files");
  DocumentFile document=resolve(path,false);
  if(document==null){if(files.has(path))throw new IOException("Cached revision index is no longer present");deferCachedBodies(files);return;}
  String encoded=readText(path);
  JSONObject state=new JSONObject(new String(Base64.decode(encoded,Base64.NO_WRAP),StandardCharsets.UTF_8));
  JSONObject notes=state.getJSONObject("notes");
  // Only the transaction/directory index is read at startup. A selected file is
  // read by readText; immutable content/history objects remain opaque pointers.
  deferCachedBodies(files);
  for(String id:FolderTransaction.keys(notes)){
   JSONObject note=notes.getJSONObject(id);String writing=note.getString("path");FolderTransaction.path(writing);
   if(!note.optBoolean("deleted",false)&&!files.has(writing))files.put(writing,deferred(writing));
   for(String key:new String[]{"bucketPath","contentPath","historyPath"}){String record=note.optString(key,"");if(!record.isEmpty()){FolderTransaction.path(record);if(!record.startsWith(".spire-android/"))throw new IOException("Invalid private record path");if(!files.has(record))files.put(record,deferred(record));}}
  }
  JSONArray folders=state.optJSONArray("folders"),dirs=tree.getJSONArray("dirs");Set<String> known=FolderTransaction.dirs(tree);
  if(folders!=null)for(int i=0;i<folders.length();i++){String folder=folders.getString(i);FolderTransaction.path(folder);if(known.add(folder))dirs.put(folder);}
  files.put(path,encoded);
 }
 private JSONObject deferred(String path)throws Exception{return new JSONObject().put("kind","saf").put("id","lazy:"+path).put("size",0).put("modified",0);}
 private void deferCachedBodies(JSONObject files)throws Exception{
  for(String path:FolderTransaction.keys(files))if(!path.equals(".spire-android/state.json")&&!path.equals(".spire-android/reliquary.json")&&text(path)&&files.opt(path) instanceof String)files.put(path,deferred(path));
 }
 private boolean atomicExists(AtomicFile file)throws IOException{
  try{file.readFully();return true;}catch(FileNotFoundException absent){return false;}
 }

 private void archiveRecovery(byte[] bytes)throws Exception{
  File backup=new File(journal.getBaseFile().getParentFile(),journal.getBaseFile().getName()+".recovered-"+System.nanoTime());
  try(FileOutputStream output=new FileOutputStream(backup)){output.write(bytes);output.getFD().sync();}
 }
 private void rememberIndex(JSONObject value,JSONObject stamps){
  FileOutputStream out=null;try{JSONObject cached=new JSONObject().put("version",1).put("tree",value).put("stamps",stamps==null?new JSONObject():stamps);out=index.startWrite();out.write(cached.toString().getBytes(StandardCharsets.UTF_8));index.finishWrite(out);}catch(Exception unavailable){if(out!=null)index.failWrite(out);/* A cache failure must not invalidate a confirmed provider write. */}
 }
 // Browse one directory using metadata only. Never recurse or open user streams.
 synchronized JSONObject listDirectory(String path)throws Exception{
  if(!path.isEmpty())FolderTransaction.path(path);
  if(path.startsWith("."))throw new IOException("Private directories are not browsable");
  DocumentFile directory=path.isEmpty()?root:resolve(path,false);
  if(directory==null)throw new FileNotFoundException("Folder unavailable");
  JSONObject files=new JSONObject();JSONArray dirs=new JSONArray();
  Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(root.getUri(),DocumentsContract.getDocumentId(directory.getUri()));
  try(Cursor cursor=context.getContentResolver().query(children,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_LAST_MODIFIED},null,null,null)){
   if(cursor==null)throw new IOException("Provider could not enumerate folder");
   while(cursor.moveToNext()){
    String name=cursor.getString(1);if(name==null)throw new IOException("Provider returned unnamed file");if(name.startsWith("."))continue;
    String child=path.isEmpty()?name:path+"/"+name;FolderTransaction.path(child);
    if(Document.MIME_TYPE_DIR.equals(cursor.getString(2)))dirs.put(child);
    else files.put(child,new Entry(cursor.getString(0),name,cursor.getString(2),cursor.getLong(3),cursor.getLong(4)).reference());
   }
  }
  return new JSONObject().put("files",files).put("dirs",dirs).put("warnings",new JSONArray());
 }
 synchronized JSONObject openDirectory()throws Exception{
  JSONObject tree=listDirectory("");
  // Keep revision/history pointers opaque; no private-directory enumeration.
  refreshIndexedMetadata(tree);
  return tree;
 }
 synchronized JSONObject load()throws Exception{
  // Legacy recovery files remain untouched. Manual Local never replays them.
  indexedFiles=null;indexedStamps=null;materialized.clear();JSONObject value=snapshot();FolderTransaction.validate(value);rememberIndex(value,scanStamps);if(atomicExists(journal))value.put("recoveryPending",true);return value;
 }
 synchronized String recoveryDescription()throws Exception{
  if(!journal.getBaseFile().exists())return null;
  JSONObject pending=new JSONObject(new String(journal.readFully(),StandardCharsets.UTF_8));
  JSONObject before=pending.getJSONObject("before"),after=pending.getJSONObject("after");
  FolderTransaction.validate(before);FolderTransaction.validate(after);
  Set<String> paths=FolderTransaction.keys(before.getJSONObject("files"));paths.addAll(FolderTransaction.keys(after.getJSONObject("files")));
  StringBuilder summary=new StringBuilder("An interrupted save is blocking changes. Finish applies the retained transaction only if the current folder still matches its expected versions. A private backup of both versions is kept.\n\n");int shown=0;
  for(String p:paths)if(!FolderTransaction.same(before.getJSONObject("files").opt(p),after.getJSONObject("files").opt(p))){if(shown++<20)summary.append(after.getJSONObject("files").has(p)?"Write: ":"Remove: ").append(p).append('\n');}
  if(shown>20)summary.append("…and ").append(shown-20).append(" more file changes.\n");
  return summary.toString();
 }
 synchronized void finishRecovery()throws Exception{
  if(!journal.getBaseFile().exists())return;
  byte[] bytes=journal.readFully();JSONObject pending=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
  JSONObject before=pending.getJSONObject("before"),after=pending.getJSONObject("after");prepare(before,after);
  JSONObject current=snapshot();FolderTransaction.checkSnapshot(current,before,after,true);
  // Keep the original journal until verified success, plus an immutable backup
  // after success. Never discard queued content to unblock the workspace.
  archiveRecovery(bytes);
  FolderTransaction.apply(this,before,after,true);journal.delete();load();
 }
 synchronized void commit(JSONObject before,JSONObject after)throws Exception{
  prepare(before,after);operationResolved=new HashMap<>();operationDirectories=new HashMap<>();
  try{
   JSONObject source=new JSONObject(before.toString()),target=new JSONObject(after.toString());
   JSONObject b=source.getJSONObject("files"),a=target.getJSONObject("files");
   Map<String,String> contents=new HashMap<>();
   for(String p:FolderTransaction.keys(b))if(b.opt(p) instanceof JSONObject&&!FolderTransaction.same(b.opt(p),a.opt(p))){
    JSONObject ref=b.getJSONObject(p);String bytes=readAttachment(p,ref);contents.put(ref.getString("id"),bytes);b.put(p,bytes);materialized.add(p);
   }
   for(String p:FolderTransaction.keys(a))if(a.opt(p) instanceof JSONObject&&!FolderTransaction.same(a.opt(p),before.getJSONObject("files").opt(p))){
    String bytes=contents.get(a.getJSONObject(p).getString("id"));if(bytes==null)throw new IOException("Unknown attachment source: "+p);a.put(p,bytes);materialized.add(p);
   }
   DirectFolderOperations.apply(new DirectFolderOperations.Backend(){
    public Object readEntry(String p)throws Exception{return readDirectEntry(p);}
    public boolean directoryExists(String p)throws Exception{DocumentFile d=resolve(p,false);return d!=null&&isDirectory(p,d);}
    public void mkdir(String p)throws Exception{LocalFolder.this.mkdir(p);}
    public Object write(String p,byte[] bytes,String encoded)throws Exception{return LocalFolder.this.writeVerified(p,bytes,encoded);}
    public void deleteFile(String p)throws Exception{LocalFolder.this.deleteFile(p);}
    public void deleteEmptyDirectory(String p)throws Exception{LocalFolder.this.deleteEmptyDirectory(p);}
   },source,target);
  }finally{
   // Materialization is transaction-scoped. Retaining these paths caused every
   // later snapshot to reopen binary media that had once been moved.
   materialized.clear();operationResolved=null;operationDirectories=null;
  }
 }
 private Object readDirectEntry(String p)throws Exception{
  FolderTransaction.path(p);DocumentFile d=resolve(p,false);if(d==null||!isFile(p,d))return null;
  if(text(p)||materialized.contains(p))return Base64.encodeToString(read(context.getContentResolver().openInputStream(d.getUri()),32*1024*1024),Base64.NO_WRAP);
  return reference(d);
 }
 private void prepare(JSONObject before,JSONObject after)throws Exception{
  FolderTransaction.validate(before);FolderTransaction.validate(after);
  for(JSONObject tree:new JSONObject[]{before,after}){JSONObject files=tree.getJSONObject("files");for(String p:FolderTransaction.keys(files))if(files.opt(p) instanceof String&&!text(p))materialized.add(p);}
 }
 static <T> T retryRead(java.util.concurrent.Callable<T> read)throws Exception{
  for(int attempt=0;;attempt++)try{return read.call();}catch(FileNotFoundException e){
   if(attempt>=2)throw e;
   try{Thread.sleep(75L*(attempt+1));}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new InterruptedIOException("Provider read retry interrupted");}
  }
 }
 private static boolean text(String p){return p.endsWith(".md")||p.endsWith(".css")||p.startsWith(".spire-android/");}
 private static byte[] read(InputStream input,int max)throws Exception{if(input==null)throw new IOException("Provider returned no stream");try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>max)throw new IOException("Local folder/file exceeds supported size");out.write(buf,0,n);}return out.toByteArray();}}
 // DocumentFile.findFile lists IDs then queries each sibling's name individually.
 // Fetch names and IDs together; never cache presence across mutation checks.
 private DocumentFile findChild(DocumentFile parent,String name,String path)throws Exception{
  Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(root.getUri(),DocumentsContract.getDocumentId(parent.getUri()));
  DocumentFile match=null;
  try(Cursor cursor=context.getContentResolver().query(children,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE},null,null,null)){
   if(cursor==null)throw new IOException("Provider failed to enumerate folder");
   while(cursor.moveToNext())if(name.equals(cursor.getString(1))){
    if(match!=null)throw new IOException("Ambiguous duplicate file name");
    match=DocumentFile.fromSingleUri(context,DocumentsContract.buildDocumentUriUsingTree(root.getUri(),cursor.getString(0)));if(operationDirectories!=null)operationDirectories.put(path,Document.MIME_TYPE_DIR.equals(cursor.getString(2)));
   }
  }
  return match;
 }
 private boolean isDirectory(String path,DocumentFile document){Boolean known=operationDirectories==null?null:operationDirectories.get(path);return known!=null?known:document.isDirectory();}
 private boolean isFile(String path,DocumentFile document){Boolean known=operationDirectories==null?null:operationDirectories.get(path);return known!=null?!known:document.isFile();}
 private DocumentFile renameDocument(DocumentFile document,String name)throws Exception{
  Uri uri=DocumentsContract.renameDocument(context.getContentResolver(),document.getUri(),name);
  if(uri==null)throw new IOException("Provider could not rename file");
  return DocumentFile.fromSingleUri(context,uri);
 }
 private DocumentFile createChild(DocumentFile parent,String mime,String name)throws Exception{
  Uri uri=DocumentsContract.createDocument(context.getContentResolver(),parent.getUri(),mime,name);
  return uri==null?null:DocumentFile.fromSingleUri(context,uri);
 }
 private DocumentFile resolve(String p,boolean parents)throws Exception{
  FolderTransaction.path(p);if(operationResolved!=null&&operationResolved.containsKey(p))return operationResolved.get(p);String[] parts=p.split("/");DocumentFile d=root;String current="";for(int i=0;i<parts.length;i++){current=current.isEmpty()?parts[i]:current+"/"+parts[i];DocumentFile next=operationResolved==null?null:operationResolved.get(current);if(next==null)next=findChild(d,parts[i],current);if(next==null&&parents&&i<parts.length-1){next=createChild(d,Document.MIME_TYPE_DIR,parts[i]);if(next!=null&&operationDirectories!=null)operationDirectories.put(current,true);}if(next==null)return null;if(i<parts.length-1&&!isDirectory(current,next))throw new IOException("File occupies directory");if(operationResolved!=null)operationResolved.put(current,next);d=next;}return d;
 }
 private DocumentFile parent(String p)throws Exception{int slash=p.lastIndexOf('/');if(slash<0)return root;String name=p.substring(0,slash);mkdir(name);DocumentFile d=resolve(name,false);if(d==null)throw new IOException("Missing directory");return d;}
 public synchronized JSONObject snapshot()throws Exception{scanWarnings=new JSONArray();scanStamps=new JSONObject();JSONObject files=new JSONObject();JSONArray dirs=new JSONArray();long[] sizes={0,0};walk(root,"",files,dirs,sizes,0);return new JSONObject().put("files",files).put("dirs",dirs).put("warnings",scanWarnings);}
 private void walk(DocumentFile d,String relative,JSONObject files,JSONArray dirs,long[] sizes,int depth)throws Exception{
  if(depth>40)throw new IOException("Folder nesting exceeds 40 levels");if(!d.canRead())throw new FileNotFoundException("Folder missing or permission revoked");
  // One metadata query per directory, not multiple provider round-trips per file.
  Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(root.getUri(),DocumentsContract.getDocumentId(d.getUri()));
  List<Entry> entries=new ArrayList<>();
  try(Cursor cursor=retryRead(()->{
   Cursor found=context.getContentResolver().query(children,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_LAST_MODIFIED},null,null,null);
   if(found==null)throw new FileNotFoundException("Provider could not enumerate this folder");return found;
  })){
   while(cursor.moveToNext())entries.add(new Entry(cursor.getString(0),cursor.getString(1),cursor.getString(2),cursor.getLong(3),cursor.getLong(4)));
  }
  entries.sort(Comparator.comparing(e->Objects.toString(e.name,"")));
  for(Entry entry:entries){
   String name=entry.name;if(name==null)throw new IOException("Provider returned unnamed file");
   if(name.startsWith(".")&&!(relative.isEmpty()&&name.equals(".spire-android")))continue;
   String p=relative.isEmpty()?name:relative+"/"+name;FolderTransaction.path(p);
   if(++sizes[1]>10000)throw new IOException("Folder exceeds 10000 entries");
   Uri uri=DocumentsContract.buildDocumentUriUsingTree(root.getUri(),entry.id);
   try {
   if(Document.MIME_TYPE_DIR.equals(entry.mime)){dirs.put(p);walk(DocumentFile.fromSingleUri(context,uri),p,files,dirs,sizes,depth+1);}
   else if(p.equals(".spire-android/state.json")||p.equals(".spire-android/reliquary.json")||materialized.contains(p)){
    JSONObject stamp=new JSONObject().put("id",entry.id).put("size",entry.size).put("modified",entry.modified);scanStamps.put(p,stamp);
    Object cached=indexedFiles==null?null:indexedFiles.opt(p);JSONObject oldStamp=indexedStamps==null?null:indexedStamps.optJSONObject(p);
    // Ordinary Markdown may use a provisional cached body when the provider's
    // positive modification stamp, stable document ID and size are unchanged.
    // Private metadata is always read authoritatively; opening a note also reads
    // that exact file before exposing it to the editor.
    if(p.endsWith(".md")&&entry.modified>0&&cached instanceof String&&oldStamp!=null&&entry.id.equals(oldStamp.optString("id"))&&entry.size==oldStamp.optLong("size",-1)&&entry.modified==oldStamp.optLong("modified",-1)){
     byte[] bytes=Base64.decode((String)cached,Base64.DEFAULT);sizes[0]+=bytes.length;if(sizes[0]>32*1024*1024)throw new IOException("Writing and metadata exceed 32 MiB including history");files.put(p,cached);continue;
    }
    byte[] bytes=retryRead(()->{InputStream stream=context.getContentResolver().openInputStream(uri);if(stream==null)throw new FileNotFoundException("Provider returned no stream");return read(stream,32*1024*1024);});sizes[0]+=bytes.length;
    if(sizes[0]>32*1024*1024)throw new IOException("Writing and metadata exceed 32 MiB including history");
    files.put(p,Base64.encodeToString(bytes,Base64.NO_WRAP));
   }else files.put(p,entry.reference()); // Never open binary streams during indexing.
   }catch(FileNotFoundException|SecurityException unavailable){
    // Metadata and recovery remain fail-closed. Only unavailable user children are skipped.
    if(p.equals(".spire-android")||p.startsWith(".spire-android/"))throw unavailable;
    for(String child:new ArrayList<>(FolderTransaction.keys(files)))if(child.equals(p)||child.startsWith(p+"/"))files.remove(child);
    for(int i=dirs.length()-1;i>=0;i--){String child=dirs.getString(i);if(child.equals(p)||child.startsWith(p+"/"))dirs.remove(i);}
    scanWarnings.put(new JSONObject().put("path",p).put("kind",Document.MIME_TYPE_DIR.equals(entry.mime)?"folder":"file").put("reason",unavailable instanceof SecurityException?"permission":"provider-read").put("message","Android could not access this item. Skipped without deleting it."));
   }
  }
 }
 private static final class Entry{
  final String id,name,mime;final long size,modified;
  Entry(String id,String name,String mime,long size,long modified){this.id=id;this.name=name;this.mime=mime;this.size=Math.max(0,size);this.modified=Math.max(0,modified);}
  JSONObject reference()throws Exception{return new JSONObject().put("kind","saf").put("id",id).put("size",size).put("modified",modified);}
 }
 private JSONObject reference(DocumentFile d)throws Exception{
  try(Cursor cursor=context.getContentResolver().query(d.getUri(),new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_LAST_MODIFIED},null,null,null)){
   if(cursor==null||!cursor.moveToFirst())throw new IOException("Attachment unavailable");
   return new Entry(cursor.getString(0),cursor.getString(1),cursor.getString(2),cursor.getLong(3),cursor.getLong(4)).reference();
  }
 }
 synchronized String readText(String path)throws Exception{
  FolderTransaction.path(path);if(!text(path))throw new IOException("Not a writing file");
  // Directory bytes are authoritative; legacy journals are not replayed.
  DocumentFile document=resolve(path,false);if(document==null||!document.isFile())throw new FileNotFoundException("File no longer available. Refresh the workspace.");
  return Base64.encodeToString(retryRead(()->read(context.getContentResolver().openInputStream(document.getUri()),32*1024*1024)),Base64.NO_WRAP);
 }
 synchronized String readAttachment(String path,JSONObject expected)throws Exception{
  FolderTransaction.path(path);FolderTransaction.reference(path,expected);
  if(expected.getLong("size")>32*1024*1024)throw new IOException("Attachment exceeds download limit");
  DocumentFile d=resolve(path,false);if(d==null||!d.isFile()||!FolderTransaction.same(reference(d),expected))throw new IOException("Attachment changed; reopen the workspace");
  byte[] bytes=read(context.getContentResolver().openInputStream(d.getUri()),32*1024*1024);
  if(bytes.length!=expected.getLong("size")||!FolderTransaction.same(reference(d),expected))throw new IOException("Attachment changed while reading");
  return Base64.encodeToString(bytes,Base64.NO_WRAP);
 }
 private DocumentFile[] listStrict(DocumentFile d)throws Exception{
  java.util.List<DocumentFile> result=new java.util.ArrayList<>();android.net.Uri children=android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(root.getUri(),android.provider.DocumentsContract.getDocumentId(d.getUri()));
  try(android.database.Cursor cursor=context.getContentResolver().query(children,new String[]{android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID},null,null,null)){if(cursor==null)throw new IOException("Provider failed to enumerate folder");while(cursor.moveToNext()){android.net.Uri uri=android.provider.DocumentsContract.buildDocumentUriUsingTree(root.getUri(),cursor.getString(0));DocumentFile child=DocumentFile.fromSingleUri(context,uri);if(child==null)throw new IOException("Provider returned invalid document");result.add(child);}}
  return result.toArray(new DocumentFile[0]);
 }
 public synchronized void mkdir(String p)throws Exception{FolderTransaction.path(p);DocumentFile d=resolve(p,true);if(d==null){int slash=p.lastIndexOf('/');DocumentFile owner=slash<0?root:resolve(p.substring(0,slash),false);if(owner==null)throw new IOException("Provider could not create parent folder");d=createChild(owner,Document.MIME_TYPE_DIR,p.substring(slash+1));if(d!=null&&operationResolved!=null){operationResolved.put(p,d);operationDirectories.put(p,true);}}if(d==null||!isDirectory(p,d))throw new IOException("Provider could not create folder");}
 public synchronized void write(String p,byte[] bytes)throws Exception{writeVerified(p,bytes,null);}
 private String writeVerified(String p,byte[] bytes,String encoded)throws Exception {
  FolderTransaction.path(p);DocumentFile old=resolve(p,false),parent=parent(p);
  if(old!=null&&!isFile(p,old))throw new IOException("A folder occupies this file path");
  String name=p.substring(p.lastIndexOf('/')+1),token=UUID.randomUUID().toString();
  // A collision-free new file has no prior bytes to protect. Create it under its
  // final name, verify the provider's chosen name and bytes, and remove it on any
  // failure. Immutable note buckets use this path before state.json switches.
  if(old==null){
   DocumentFile created=createChild(parent,"application/octet-stream",name);boolean confirmed=false;
   if(created==null)throw new IOException("Provider could not create file");
   try{
    if(!name.equals(created.getName()))throw new IOException("Provider did not create the requested file name");
    try(OutputStream out=context.getContentResolver().openOutputStream(created.getUri(),"wt")){if(out==null)throw new IOException("Provider is not writable");out.write(bytes);}
    if(!Arrays.equals(bytes,read(context.getContentResolver().openInputStream(created.getUri()),32*1024*1024)))throw new IOException("New file readback failed");
    confirmed=true;
   }finally{
    if(!confirmed&&!created.delete())throw new IOException("Incomplete new file could not be removed: "+name);
   }
   if(operationResolved!=null){operationResolved.remove(p);operationDirectories.remove(p);}
   return encoded==null?Base64.encodeToString(bytes,Base64.NO_WRAP):encoded;
  }
  DocumentFile staged=createChild(parent,"application/octet-stream",".spire-write-"+token);
  if(staged==null)throw new IOException("Provider could not stage file");
  // Replacements still require staging: never truncate the original in place.
  boolean installed=false,originalRenamed=false;
  try{
   try(OutputStream out=context.getContentResolver().openOutputStream(staged.getUri(),"wt")){if(out==null)throw new IOException("Provider is not writable");out.write(bytes);}
   if(!Arrays.equals(bytes,read(context.getContentResolver().openInputStream(staged.getUri()),32*1024*1024)))throw new IOException("Staged write readback failed; original unchanged");
   if(old!=null){old=renameDocument(old,".spire-replace-"+token);originalRenamed=true;}
   staged=renameDocument(staged,name);
   if(!name.equals(staged.getName()))throw new IOException("Provider did not install the staged file under its requested name");
   installed=true;
   if(old!=null&&!old.delete())throw new IOException("File saved, but temporary original could not be removed: .spire-replace-"+token);
  }finally{
   if(!installed){
    // Preserve the original under its normal name where provider rollback permits.
    boolean removed=staged.delete();
    if(originalRenamed){
     try{if(!removed)throw new IOException("Staged file could not be removed");renameDocument(old,name);}
     catch(Exception restore){throw new IOException("Provider replacement failed. Original retained as .spire-replace-"+token+"; do not retry until reviewed.",restore);}
    }
   }
  }
  if(operationResolved!=null){operationResolved.remove(p);operationDirectories.remove(p);}
  return encoded==null?Base64.encodeToString(bytes,Base64.NO_WRAP):encoded;
 }
 public synchronized void deleteFile(String p)throws Exception{DocumentFile d=resolve(p,false);if(d!=null&&(!isFile(p,d)||!d.delete()))throw new IOException("Could not remove old file");if(operationResolved!=null){operationResolved.remove(p);operationDirectories.remove(p);}}
 public synchronized void deleteEmptyDirectory(String p)throws Exception{DocumentFile d=resolve(p,false);if(d!=null&&(!isDirectory(p,d)||listStrict(d).length!=0||!d.delete()))throw new IOException("Folder is not empty or cannot be removed");if(operationResolved!=null){operationResolved.keySet().removeIf(k->k.equals(p)||k.startsWith(p+"/"));operationDirectories.keySet().removeIf(k->k.equals(p)||k.startsWith(p+"/"));}}
 // Bundled assets must never contend for the SAF transaction monitor.
 WebResourceResponse resource(Uri url)throws Exception{return resource(url,null);}
 WebResourceResponse resource(Uri url,String rangeHeader)throws Exception{
  if(!ServerAddress.sameOrigin(origin,url.toString()))return blocked();String p=url.getPath();
  if("/api/attachment".equals(p)){
   String file=url.getQueryParameter("path");FolderTransaction.path(file==null?"":file);if(file.startsWith(".spire-android"))return blocked();
   DocumentFile d=resolve(file,false);if(d==null||!d.isFile())return blocked();
   String extension=file.substring(file.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);String mime=switch(extension){case "mp4"->"video/mp4";case "webm"->"video/webm";case "ogv"->"video/ogg";case "mov"->"video/quicktime";default->android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);};
   long size=d.length();MediaRange range;
   try{range=MediaRange.parse(rangeHeader,size);}catch(IllegalArgumentException invalid){return new WebResourceResponse("text/plain",null,416,"Range Not Satisfiable",Map.of("Content-Range","bytes */"+size,"Content-Length","0","Accept-Ranges","bytes"),new ByteArrayInputStream(new byte[0]));}
   Map<String,String> headers=new HashMap<>();headers.put("Content-Length",Long.toString(range.length()));headers.put("Accept-Ranges","bytes");headers.put("Cache-Control","no-store");headers.put("Content-Security-Policy","sandbox; default-src 'none'");headers.put("X-Content-Type-Options","nosniff");
   if(range.partial)headers.put("Content-Range","bytes "+range.start+"-"+range.end+"/"+size);
   return new WebResourceResponse(mime==null?"application/octet-stream":mime,null,range.partial?206:200,range.partial?"Partial Content":"OK",headers,range.stream(context.getContentResolver().openInputStream(d.getUri())));
  }
  if(p==null||p.contains("..")||p.contains("\\")||p.startsWith("/api/"))return blocked();if(p.equals("/"))p="/index.html";
  // No service worker may bypass the native local API adapter or cache stale editor builds.
  if(p.equals("/sw.js"))return blocked();String mime=(p.endsWith(".js")||p.endsWith(".mjs"))?"application/javascript":p.endsWith(".wasm")?"application/wasm":p.endsWith(".css")?"text/css":p.endsWith(".html")?"text/html":p.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
  return new WebResourceResponse(mime,"UTF-8",200,"OK",Map.of("Cache-Control","no-store","Content-Security-Policy","default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'","X-Content-Type-Options","nosniff"),context.getAssets().open("web"+p));
 }
 static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
}
