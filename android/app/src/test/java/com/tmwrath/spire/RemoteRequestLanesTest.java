package com.tmwrath.spire;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
public class RemoteRequestLanesTest {
 @Test public void stalledAttachmentDoesNotBlockDocumentOpenOrIdentity() throws Exception {
  RemoteRequestLanes lanes=new RemoteRequestLanes();CountDownLatch started=new CountDownLatch(1),release=new CountDownLatch(1),document=new CountDownLatch(1),identity=new CountDownLatch(1);
  try {
   lanes.execute(new JSONObject().put("path","/api/device-workspaces/self/attachment?path=Attachments/movie.mp4").put("method","GET"),()->{started.countDown();try{release.await();}catch(InterruptedException e){Thread.currentThread().interrupt();}});
   assertTrue(started.await(2,TimeUnit.SECONDS));
   lanes.execute(new JSONObject().put("path","/api/content?path=Notes/a.md").put("method","GET"),document::countDown);
   lanes.execute(new JSONObject().put("path","/api/me").put("method","GET"),identity::countDown);
   assertTrue("Document open waited for attachment bytes",document.await(2,TimeUnit.SECONDS));
   assertTrue("Identity waited for attachment bytes",identity.await(2,TimeUnit.SECONDS));
  } finally {release.countDown();lanes.close();}
 }
 @Test public void onlyMediaEndpointsUseMediaLane() throws Exception {
  assertTrue(RemoteRequestLanes.isMedia(new JSONObject().put("path","/api/attachment?path=a.png")));
  assertTrue(RemoteRequestLanes.isMedia(new JSONObject().put("path","/api/attachments")));
  assertTrue(RemoteRequestLanes.isMedia(new JSONObject().put("path","/api/device-workspaces/self/attachment-info?path=a.png")));
  assertFalse(RemoteRequestLanes.isMedia(new JSONObject().put("path","/api/content?path=attachment.md")));
  assertFalse(RemoteRequestLanes.isMedia(new JSONObject().put("operation","device-state")));
 }
}
