package com.tmwrath.spire;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.json.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
public class MediaQueueStoreTest {
 JSONObject task(String path)throws Exception{return new JSONObject().put("tree","content://provider/tree/test").put("origin","https://spire.example").put("workspace","https://w-test.spire.invalid").put("device","device-a").put("account","owner").put("path",path).put("size",12);}
 @Test public void enqueuePersistsAndDeduplicatesAcrossInstances()throws Exception{
  MediaQueueStore s=new MediaQueueStore(RuntimeEnvironment.getApplication());s.clearForTest();String id=s.enqueue(task("Attachments/a.mp4"));
  MediaQueueStore reopened=new MediaQueueStore(RuntimeEnvironment.getApplication());assertEquals(id,reopened.enqueue(task("Attachments/a.mp4")));assertEquals("pending",reopened.get(id).getString("state"));
 }
 @Test public void processDeathRequeuesWithoutClaimingSuccess()throws Exception{
  MediaQueueStore s=new MediaQueueStore(RuntimeEnvironment.getApplication());s.clearForTest();String id=s.enqueue(task("Attachments/a.mp4"));s.update(id,new JSONObject().put("state","transferring"));
  MediaQueueStore reopened=new MediaQueueStore(RuntimeEnvironment.getApplication());reopened.recover();assertEquals("pending",reopened.get(id).getString("state"));assertFalse(reopened.get(id).has("hash"));
 }
 @Test public void failedFileDoesNotHideAnotherQueuedFile()throws Exception{
  MediaQueueStore s=new MediaQueueStore(RuntimeEnvironment.getApplication());s.clearForTest();String a=s.enqueue(task("Attachments/a.mp4")),b=s.enqueue(task("Attachments/b.mp4"));s.update(a,new JSONObject().put("state","failed").put("retryAt",Long.MAX_VALUE));assertEquals(b,s.next(System.currentTimeMillis()).getString("taskId"));
 }
 @Test public void serverAndFolderScopesDoNotShareTasks()throws Exception{
  MediaQueueStore s=new MediaQueueStore(RuntimeEnvironment.getApplication());s.clearForTest();String a=s.enqueue(task("Attachments/a.mp4"));JSONObject other=task("Attachments/a.mp4").put("tree","content://provider/tree/other");assertNotEquals(a,s.enqueue(other));
 }
}
