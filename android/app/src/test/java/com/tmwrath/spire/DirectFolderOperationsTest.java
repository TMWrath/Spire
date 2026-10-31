package com.tmwrath.spire;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.*;
import android.util.Base64;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DirectFolderOperationsTest {
 static String encoded(String text){return Base64.encodeToString(text.getBytes(java.nio.charset.StandardCharsets.UTF_8),Base64.NO_WRAP);}
 static JSONObject tree(String[] dirs,String... entries)throws Exception{JSONObject files=new JSONObject();for(int i=0;i<entries.length;i+=2)files.put(entries[i],encoded(entries[i+1]));return new JSONObject().put("files",files).put("dirs",new JSONArray(Arrays.asList(dirs)));}
 static class Memory implements DirectFolderOperations.Backend {
  final Map<String,Object> files=new HashMap<>();final Set<String> dirs=new HashSet<>();final List<String> reads=new ArrayList<>(),writes=new ArrayList<>();String failWrite;
  Memory(JSONObject t)throws Exception{JSONObject f=t.getJSONObject("files");for(String p:FolderTransaction.keys(f))files.put(p,f.get(p));dirs.addAll(FolderTransaction.dirs(t));}
  public Object readEntry(String p){reads.add(p);return files.get(p);}
  public boolean directoryExists(String p){return dirs.contains(p);}
  public void mkdir(String p){dirs.add(p);}
  public Object write(String p,byte[] b,String encoded)throws Exception{if(p.equals(failWrite))throw new Exception("simulated failure");files.put(p,encoded);writes.add(p);return encoded;}
  public void deleteFile(String p){files.remove(p);}
  public void deleteEmptyDirectory(String p)throws Exception{if(files.keySet().stream().anyMatch(f->f.startsWith(p+"/"))||dirs.stream().anyMatch(d->d.startsWith(p+"/")))throw new Exception("not empty");dirs.remove(p);}
 }
 @Test public void compactCreateMoveDeletePreservesOmittedFiles()throws Exception{
  String[] dirs={"A","B"};Memory m=new Memory(tree(dirs,"A/unrelated.md","keep"));
  DirectFolderOperations.apply(m,tree(dirs),tree(dirs,"A/new.md","new"));
  DirectFolderOperations.apply(m,tree(dirs,"A/new.md","new"),tree(dirs,"B/new.md","new"));
  DirectFolderOperations.apply(m,tree(dirs,"B/new.md","new"),tree(dirs));
  assertEquals(Map.of("A/unrelated.md",encoded("keep")),m.files);
  assertFalse(m.reads.contains("A/unrelated.md"));
 }
 @Test public void compactFolderDeleteRefusesUntrackedContents()throws Exception{
  Memory m=new Memory(tree(new String[]{"A"},"A/external.md","keep"));
  assertThrows(Exception.class,()->DirectFolderOperations.apply(m,tree(new String[]{"A"}),tree(new String[]{})));
  assertEquals(encoded("keep"),m.files.get("A/external.md"));assertTrue(m.dirs.contains("A"));
 }
 @Test public void singleSaveNeverReadsUnrelatedFile()throws Exception{
  JSONObject before=tree(new String[]{"A","B"},"A/a.md","old","B/other.md","untouched"),after=new JSONObject(before.toString());after.getJSONObject("files").put("A/a.md",encoded("edited"));Memory m=new Memory(before);
  DirectFolderOperations.apply(m,before,after);assertEquals(encoded("edited"),m.files.get("A/a.md"));assertFalse(m.reads.contains("B/other.md"));assertEquals(List.of("A/a.md"),m.writes);
 }
 @Test public void fileMoveCreatesDestinationThenRemovesSource()throws Exception{
  JSONObject before=tree(new String[]{"A"},"A/a.md","hello"),after=tree(new String[]{"A","New"},"New/a.md","hello");Memory m=new Memory(before);
  DirectFolderOperations.apply(m,before,after);assertFalse(m.files.containsKey("A/a.md"));assertEquals(encoded("hello"),m.files.get("New/a.md"));assertTrue(m.dirs.contains("New"));
 }
 @Test public void nestedFolderMovePreservesDescendants()throws Exception{
  JSONObject before=tree(new String[]{"A","A/Child","Target"},"A/Child/a.md","hello"),after=tree(new String[]{"Target","Target/A","Target/A/Child"},"Target/A/Child/a.md","hello");Memory m=new Memory(before);
  DirectFolderOperations.apply(m,before,after);assertEquals(Set.of("Target","Target/A","Target/A/Child"),m.dirs);assertEquals(encoded("hello"),m.files.get("Target/A/Child/a.md"));
 }
 @Test public void destinationFailureNeverRemovesSource()throws Exception{
  JSONObject before=tree(new String[]{"A","B"},"A/a.md","hello"),after=tree(new String[]{"A","B"},"B/a.md","hello");Memory m=new Memory(before);m.failWrite="B/a.md";
  assertThrows(Exception.class,()->DirectFolderOperations.apply(m,before,after));assertEquals(encoded("hello"),m.files.get("A/a.md"));
 }
 @Test public void destinationCollisionMakesNoWrites()throws Exception{
  JSONObject before=tree(new String[]{"A","B"},"A/a.md","hello"),after=tree(new String[]{"A","B"},"B/a.md","hello");Memory m=new Memory(before);m.files.put("B/a.md",encoded("external"));
  assertThrows(Exception.class,()->DirectFolderOperations.apply(m,before,after));assertTrue(m.writes.isEmpty());assertEquals(encoded("hello"),m.files.get("A/a.md"));
 }
 @Test public void staleFileIsNeverOverwritten()throws Exception{
  JSONObject before=tree(new String[]{"A"},"A/a.md","old"),after=tree(new String[]{"A"},"A/a.md","edited");Memory m=new Memory(before);m.files.put("A/a.md",encoded("external"));
  assertThrows(Exception.class,()->DirectFolderOperations.apply(m,before,after));assertEquals(encoded("external"),m.files.get("A/a.md"));assertTrue(m.writes.isEmpty());
 }
 @Test public void immutableBucketIsVerifiedBeforeStateIndexSwitch()throws Exception{
  JSONObject before=tree(new String[]{".spire-android"},".spire-android/state.json","old-state"),after=tree(new String[]{".spire-android"},".spire-android/state.json","new-state",".spire-android/notes-01-2.json","bucket");Memory m=new Memory(before);
  DirectFolderOperations.apply(m,before,after);
  assertEquals(List.of(".spire-android/notes-01-2.json",".spire-android/state.json"),m.writes);
 }
 @Test public void failedStateSwitchLeavesOldIndexAndNewImmutableBucketRecoverable()throws Exception{
  JSONObject before=tree(new String[]{".spire-android"},".spire-android/state.json","old-state"),after=tree(new String[]{".spire-android"},".spire-android/state.json","new-state",".spire-android/notes-01-2.json","bucket");Memory m=new Memory(before);m.failWrite=".spire-android/state.json";
  assertThrows(Exception.class,()->DirectFolderOperations.apply(m,before,after));
  assertEquals(encoded("old-state"),m.files.get(".spire-android/state.json"));assertEquals(encoded("bucket"),m.files.get(".spire-android/notes-01-2.json"));
 }
 @Test public void alreadyRemovedUnreferencedRevisionObjectDoesNotBlockNextSave()throws Exception{
  JSONObject before=tree(new String[]{".spire-android","Writing"},
   ".spire-android/state.json","old-state",
   ".spire-android/notes-07-384.json","obsolete revision object",
   "Writing/file.md","old");
  JSONObject after=tree(new String[]{".spire-android","Writing"},
   ".spire-android/state.json","new-state",
   ".spire-android/notes-07-385.json","new revision object",
   "Writing/file.md","edited");
  Memory m=new Memory(before);m.files.remove(".spire-android/notes-07-384.json");
  DirectFolderOperations.apply(m,before,after);
  assertEquals(encoded("edited"),m.files.get("Writing/file.md"));
  assertEquals(encoded("new-state"),m.files.get(".spire-android/state.json"));
  assertEquals(encoded("new revision object"),m.files.get(".spire-android/notes-07-385.json"));
 }
}
