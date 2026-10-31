package com.tmwrath.spire;
import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;
@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner.class) @org.robolectric.annotation.Config(sdk=35)
public class BridgeChunksTest {
 @Test public void reorderedChunksAreAppliedOnlyWhenComplete()throws Exception{
  BridgeChunks chunks=new BridgeChunks();String raw=new JSONObject().put("id",5).put("operation","device-state").put("state",new JSONObject().put("op","import")).toString();int middle=raw.length()/2;
  JSONObject second=new JSONObject().put("id",5).put("operation","request-part").put("total",2).put("index",1).put("part",raw.substring(middle));
  assertNull(chunks.accept(second));assertNull(chunks.accept(second));
  JSONObject first=new JSONObject(second.toString()).put("index",0).put("part",raw.substring(0,middle));assertEquals(raw,chunks.accept(first).toString());
 }
 @Test public void identityChangeAndInvalidDimensionsAreRejected()throws Exception{
  BridgeChunks chunks=new BridgeChunks();JSONObject m=new JSONObject().put("id",5).put("operation","request-part").put("total",1).put("index",0).put("part","{\"id\":6}");
  try{chunks.accept(m);fail("identity changed");}catch(Exception expected){}
  for(int index:new int[]{-1,1,1024})try{chunks.accept(new JSONObject(m.toString()).put("index",index));fail("index accepted");}catch(Exception expected){}
 }
 @Test public void conflictingDuplicatesNeverReachStorage()throws Exception{
  BridgeChunks chunks=new BridgeChunks();JSONObject m=new JSONObject().put("id",5).put("operation","request-part").put("total",2).put("index",0).put("part","first");assertNull(chunks.accept(m));
  try{chunks.accept(new JSONObject(m.toString()).put("part","different"));fail("conflicting chunk");}catch(Exception expected){}
 }
}
