package com.tmwrath.spire;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.json.*;
import java.util.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class FolderTransactionTest {
 static JSONObject tree(String text)throws Exception{return new JSONObject().put("files",new JSONObject().put("Writing/a.md",android.util.Base64.encodeToString(text.getBytes(java.nio.charset.StandardCharsets.UTF_8),2))).put("dirs",new JSONArray().put("Writing"));}
 static class Memory implements FolderTransaction.Backend {
  JSONObject tree;int writes=0,snapshots=0;boolean fail=false;
  Memory(JSONObject t){tree=t;}
  public JSONObject snapshot()throws Exception{snapshots++;return new JSONObject(tree.toString());}
  public void mkdir(String p)throws Exception{tree.getJSONArray("dirs").put(p);}
  public void write(String p,byte[] b)throws Exception{writes++;if(fail)throw new Exception("revoked");tree.getJSONObject("files").put(p,android.util.Base64.encodeToString(b,2));}
  public void deleteFile(String p)throws Exception{tree.getJSONObject("files").remove(p);}
  public void deleteEmptyDirectory(String p)throws Exception{JSONArray d=tree.getJSONArray("dirs"),n=new JSONArray();for(int i=0;i<d.length();i++)if(!d.getString(i).equals(p))n.put(d.getString(i));tree.put("dirs",n);}
 }
 @Test public void referenceMediaIsPreservedWithoutByteWrites()throws Exception{
  JSONObject before=tree("old");before.getJSONObject("files").put("Writing/large.mp4",new JSONObject().put("kind","saf").put("id","opaque").put("size",8000000000L).put("modified",1));
  JSONObject after=new JSONObject(before.toString());after.getJSONObject("files").put("Writing/a.md","bmV3");Memory m=new Memory(new JSONObject(before.toString()));FolderTransaction.apply(m,before,after,false);assertEquals(1,m.writes);assertEquals(8000000000L,m.tree.getJSONObject("files").getJSONObject("Writing/large.mp4").getLong("size"));
 }
 @Test public void referenceReplacementOrRemovalIsRejected()throws Exception{
  JSONObject before=tree("old");before.getJSONObject("files").put("Writing/large.mp4",new JSONObject().put("kind","saf").put("id","opaque").put("size",99).put("modified",1));
  for(boolean remove:new boolean[]{false,true}){JSONObject after=new JSONObject(before.toString());if(remove)after.getJSONObject("files").remove("Writing/large.mp4");else after.getJSONObject("files").put("Writing/large.mp4","YQ==");Memory m=new Memory(new JSONObject(before.toString()));assertThrows(Exception.class,()->FolderTransaction.apply(m,before,after,false));assertEquals(0,m.writes);}
 }
 @Test public void transactionUsesOnlyOnePreflightAndOneReadbackScan()throws Exception{Memory m=new Memory(tree("old"));FolderTransaction.apply(m,tree("old"),tree("new"),false);assertEquals(2,m.snapshots);assertEquals(1,m.writes);}
 @Test public void savesThenVerifiesRealBytes()throws Exception{Memory m=new Memory(tree("old"));FolderTransaction.apply(m,tree("old"),tree("new"),false);assertEquals(tree("new").getJSONObject("files").toString(),m.tree.getJSONObject("files").toString());assertEquals(1,m.writes);}
 @Test public void externalEditsNeverOverwritten()throws Exception{Memory m=new Memory(tree("external"));assertThrows(Exception.class,()->FolderTransaction.apply(m,tree("old"),tree("new"),false));assertEquals(0,m.writes);}
 @Test public void replayAcceptsAlreadyWrittenBytes()throws Exception{Memory m=new Memory(tree("new"));FolderTransaction.apply(m,tree("old"),tree("new"),true);assertEquals(0,m.writes);}
 @Test public void traversalAndHiddenFilesRejected()throws Exception{Memory m=new Memory(tree("old"));for(String path:new String[]{"../outside","a/../../outside","/absolute","Writing/.private",".secret"}){JSONObject next=tree("new");next.getJSONObject("files").put(path,"");assertThrows(Exception.class,()->FolderTransaction.apply(m,tree("old"),next,false));}assertEquals(0,m.writes);}
 @Test public void nativeFailureDoesNotSucceed()throws Exception{Memory m=new Memory(tree("old"));m.fail=true;assertThrows(Exception.class,()->FolderTransaction.apply(m,tree("old"),tree("new"),false));assertEquals(tree("old").getJSONObject("files").toString(),m.tree.getJSONObject("files").toString());}
 @Test public void untrackedFilesPreventReplay()throws Exception{Memory m=new Memory(tree("old"));m.tree.getJSONObject("files").put("Writing/other.md","");assertThrows(Exception.class,()->FolderTransaction.apply(m,tree("old"),tree("new"),true));assertEquals(0,m.writes);}
}
