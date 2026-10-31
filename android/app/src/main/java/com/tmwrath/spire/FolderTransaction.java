package com.tmwrath.spire;
import org.json.*;
import android.util.Base64;
import java.util.*;

/** Provider-independent, fail-closed write plan. A durable journal is owned by LocalFolder. */
final class FolderTransaction {
 interface Backend { JSONObject snapshot()throws Exception;void mkdir(String p)throws Exception;void write(String p,byte[] bytes)throws Exception;void deleteFile(String p)throws Exception;void deleteEmptyDirectory(String p)throws Exception; }
 static void path(String p)throws Exception{
  if(p.isEmpty()||p.length()>260||p.startsWith("/")||p.matches(".*[\\\\\\x00-\\x1f<>:\"|?*%].*"))throw new Exception("Unsafe folder path");
  String[] parts=p.split("/",-1);for(int i=0;i<parts.length;i++){String s=parts[i];if(s.isEmpty()||s.equals(".")||s.equals("..")||(s.startsWith(".")&&!(i==0&&s.equals(".spire-android")))||s.endsWith(".")||s.endsWith(" "))throw new Exception("Unsafe folder path");}
  if(parts[0].equals(".spire-android")){boolean known=parts.length==1||parts.length==2&&(Arrays.asList("state.json","pending.json","reliquary.json").contains(parts[1])||parts[1].matches("notes-[0-9a-f]{2}(?:-[0-9]+)?\\.json")||parts[1].matches("(?:content|history)-[a-f0-9-]{36}\\.json"));if(!known)throw new Exception("Unknown private metadata path");}
 }
 static Set<String> keys(JSONObject o){Set<String>s=new TreeSet<>();o.keys().forEachRemaining(s::add);return s;}
 static Set<String> dirs(JSONObject tree)throws Exception{Set<String>s=new TreeSet<>();JSONArray a=tree.getJSONArray("dirs");for(int i=0;i<a.length();i++)s.add(a.getString(i));return s;}
 static boolean same(Object a,Object b){
  if(a instanceof JSONObject&&b instanceof JSONObject){JSONObject x=(JSONObject)a,y=(JSONObject)b;if(!keys(x).equals(keys(y)))return false;for(String k:keys(x))if(!same(x.opt(k),y.opt(k)))return false;return true;}
  if(a instanceof Number&&b instanceof Number)return a.toString().equals(b.toString());
  return Objects.equals(a,b);
 }
 static void reference(String path,JSONObject ref)throws Exception{
  if(!ref.getString("kind").equals("saf")||ref.getString("id").isEmpty()||ref.getLong("size")<0||ref.getLong("modified")<0)throw new Exception("Invalid deferred attachment reference");
 }
 static void validate(JSONObject t)throws Exception{JSONObject f=t.getJSONObject("files");Set<String>d=dirs(t),seen=new HashSet<>();long total=0;if(f.length()+d.size()>10000)throw new Exception("Folder exceeds 10000 entries");for(String p:d){path(p);if(!seen.add(p.toLowerCase(Locale.ROOT)))throw new Exception("Case-colliding paths");}for(String p:keys(f)){path(p);if(!seen.add(p.toLowerCase(Locale.ROOT)))throw new Exception("Case-colliding paths");Object entry=f.get(p);if(entry instanceof JSONObject){reference(p,(JSONObject)entry);continue;}String value=f.getString(p);if(value.length()>48*1024*1024)throw new Exception("File too large");total+=Base64.decode(value,Base64.NO_WRAP).length;if(total>32*1024*1024)throw new Exception("Local folder exceeds 32 MiB including history");}}
 static void check(Backend backend,JSONObject before,JSONObject after,boolean replay)throws Exception{
  checkSnapshot(backend.snapshot(),before,after,replay);
 }
 static void checkSnapshot(JSONObject current,JSONObject before,JSONObject after,boolean replay)throws Exception{
  validate(before);validate(after);JSONObject b=before.getJSONObject("files"),a=after.getJSONObject("files"),c=current.getJSONObject("files");
  for(String p:keys(b))if(b.opt(p) instanceof JSONObject&&!same(b.opt(p),a.opt(p)))throw new Exception("Deferred attachments cannot be overwritten or removed: "+p);for(String p:keys(a))if(a.opt(p) instanceof JSONObject&&!same(a.opt(p),b.opt(p)))throw new Exception("Cannot create a provider reference: "+p);
  Set<String>all=keys(b);all.addAll(keys(a));all.addAll(keys(c));for(String p:all){Object now=c.opt(p);if(!same(now,b.opt(p))&&!(replay&&same(now,a.opt(p))))throw new Exception("External change requires recovery: "+p);}
  Set<String>bd=dirs(before),ad=dirs(after),cd=dirs(current),allowed=new HashSet<>(bd);if(replay)allowed.addAll(ad);if(!allowed.containsAll(cd)||(!replay&&!cd.equals(bd)))throw new Exception("External folder change requires recovery");
 }
 static void apply(Backend backend,JSONObject before,JSONObject after,boolean replay)throws Exception{
  applySnapshot(backend,before,after,replay,backend.snapshot());
 }
 static void applySnapshot(Backend backend,JSONObject before,JSONObject after,boolean replay,JSONObject current)throws Exception{
  checkSnapshot(current,before,after,replay);JSONObject c=current.getJSONObject("files"),a=after.getJSONObject("files");
  List<String>create=new ArrayList<>(dirs(after));create.sort(Comparator.comparingInt(String::length));for(String p:create)if(!dirs(current).contains(p))backend.mkdir(p);
  List<String>write=new ArrayList<>(keys(a));write.sort(Comparator.comparing(p->p.startsWith(".spire-android/")?1:0));for(String p:write)if(!same(a.opt(p),c.opt(p)))backend.write(p,Base64.decode(a.getString(p),Base64.NO_WRAP));
  for(String p:keys(before.getJSONObject("files")))if(!a.has(p)&&c.has(p))backend.deleteFile(p);
  List<String>remove=new ArrayList<>(dirs(before));remove.sort(Comparator.comparingInt(String::length).reversed());for(String p:remove)if(!dirs(after).contains(p))backend.deleteEmptyDirectory(p);
  JSONObject result=backend.snapshot();if(!keys(result.getJSONObject("files")).equals(keys(a))||!dirs(result).equals(dirs(after)))throw new Exception("Provider did not persist the complete transaction");for(String p:keys(a))if(!same(a.opt(p),result.getJSONObject("files").opt(p)))throw new Exception("Provider write verification failed: "+p);
 }
}
