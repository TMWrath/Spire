package com.tmwrath.spire;

import org.json.JSONObject;
import android.util.Base64;
import java.util.*;

/** Manual Local commands. No whole-workspace scan, journal, replay or background work. */
final class DirectFolderOperations {
 interface Backend {
  Object readEntry(String path)throws Exception;
  boolean directoryExists(String path)throws Exception;
  void mkdir(String path)throws Exception;
  Object write(String path,byte[] bytes,String encoded)throws Exception;
  void deleteFile(String path)throws Exception;
  void deleteEmptyDirectory(String path)throws Exception;
 }
 static void apply(Backend backend,JSONObject before,JSONObject after)throws Exception {
  FolderTransaction.validate(before);FolderTransaction.validate(after);
  JSONObject b=before.getJSONObject("files"),a=after.getJSONObject("files");
  Set<String> changed=FolderTransaction.keys(b);changed.addAll(FolderTransaction.keys(a));
  changed.removeIf(p->FolderTransaction.same(b.opt(p),a.opt(p)));
  Set<String> bd=FolderTransaction.dirs(before),ad=FolderTransaction.dirs(after);
  Set<String> create=new TreeSet<>(ad);create.removeAll(bd);
  Set<String> remove=new TreeSet<>(bd);remove.removeAll(ad);
  // Check every affected source and destination before the first side effect.
  for(String p:changed){
   if(b.opt(p) instanceof JSONObject||a.opt(p) instanceof JSONObject)throw new Exception("Load the affected attachment bytes before moving: "+p);
   Object current=backend.readEntry(p);
   // Immutable metadata generations are Git-like objects: once state.json no
   // longer points at one, deleting it is idempotent. A provider or a previous
   // interrupted cleanup may already have removed that unreachable object.
   // Do not turn that harmless cleanup state into a user-file conflict.
   boolean obsoleteMetadata=!a.has(p)&&p.matches("\\.spire-android/notes-[0-9a-f]{2}-[0-9]+\\.json");
   if(!(obsoleteMetadata&&current==null)&&!FolderTransaction.same(current,b.opt(p)))throw new Exception("File changed outside Spire. Reopen before saving: "+p);
   if(backend.directoryExists(p))throw new Exception("A folder occupies the file destination: "+p);
  }
  for(String p:create)if(backend.directoryExists(p)||backend.readEntry(p)!=null)throw new Exception("Destination already exists: "+p);
  for(String p:remove)if(!backend.directoryExists(p))throw new Exception("Source folder is unavailable: "+p);
  Set<String> parents=new TreeSet<>();
  for(String p:changed){int slash=p.lastIndexOf('/');while(slash>=0){String parent=p.substring(0,slash);parents.add(parent);slash=parent.lastIndexOf('/');}}
  for(String p:parents)if(bd.contains(p)&&!backend.directoryExists(p))throw new Exception("Parent folder is unavailable: "+p);
  List<String> ordered=new ArrayList<>(create);ordered.sort(Comparator.comparingInt(String::length));
  for(String p:ordered)backend.mkdir(p);
  // Persist immutable preimages/history before touching user documents. If a
  // provider fails later, the previous index and these objects retain both sides.
  List<String> records=new ArrayList<>();for(String p:changed)if(a.has(p)&&p.startsWith(".spire-android/")&&!p.equals(".spire-android/state.json"))records.add(p);
  Collections.sort(records);for(String p:records)writeChecked(backend,p,b.opt(p),a.getString(p));
  // Copy and verify destinations before removing any source; the index is last.
  for(String p:changed)if(a.has(p)&&!p.startsWith(".spire-android/"))writeChecked(backend,p,b.opt(p),a.getString(p));
  for(String p:changed)if(!a.has(p)){
   Object current=backend.readEntry(p);
   boolean obsoleteMetadata=p.matches("\\.spire-android/notes-[0-9a-f]{2}-[0-9]+\\.json");
   if(obsoleteMetadata&&current==null)continue;
   if(!FolderTransaction.same(current,b.opt(p)))throw new Exception("Source changed during move; it was not removed: "+p);
   backend.deleteFile(p);
  }
  ordered=new ArrayList<>(remove);ordered.sort(Comparator.comparingInt(String::length).reversed());
  for(String p:ordered)backend.deleteEmptyDirectory(p);
  // Immutable note buckets must be confirmed before state.json performs the
  // atomic logical switch. Never rely on HashSet iteration order for recovery.
  List<String> metadata=new ArrayList<>();for(String p:changed)if(a.has(p)&&p.equals(".spire-android/state.json"))metadata.add(p);
  metadata.sort((left,right)->{if(left.equals(".spire-android/state.json"))return 1;if(right.equals(".spire-android/state.json"))return -1;return left.compareTo(right);});
  for(String p:metadata)writeChecked(backend,p,b.opt(p),a.getString(p));

 }
 private static void writeChecked(Backend backend,String path,Object expected,String encoded)throws Exception {
  if(!FolderTransaction.same(backend.readEntry(path),expected))throw new Exception("Destination changed during operation: "+path);
  Object confirmed=backend.write(path,Base64.decode(encoded,Base64.NO_WRAP),encoded);
  if(!FolderTransaction.same(confirmed,encoded))throw new Exception("Save verification failed: "+path);
 }
}
