package com.tmwrath.spire;
import android.app.job.*;
import android.content.*;
import android.net.Uri;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
/** OS-owned durable work, independent of the Activity, WebView and JS event loop.
 * Interrupted requests restart with a fresh hash probe/CAS, never a blind duplicate PUT.
 * Android force-stop suspends jobs until the user launches the app again. */
public final class MediaTransferJob extends JobService {
 static final int JOB_ID=7311;
 private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
 private AtomicBoolean stopped=new AtomicBoolean();
 static void schedule(Context context){JobScheduler scheduler=(JobScheduler)context.getSystemService(Context.JOB_SCHEDULER_SERVICE);if(scheduler.getPendingJob(JOB_ID)==null){JobInfo job=new JobInfo.Builder(JOB_ID,new ComponentName(context,MediaTransferJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build();if(scheduler.schedule(job)!=JobScheduler.RESULT_SUCCESS)throw new IllegalStateException("Android could not schedule background transfers");}}
 @Override public boolean onStartJob(JobParameters parameters){
  final AtomicBoolean stop=new AtomicBoolean();stopped=stop;
  EXECUTOR.execute(()->{MediaQueueStore store=new MediaQueueStore(getApplicationContext());boolean retry=true;try{
   store.recover();long deadline=System.currentTimeMillis()+4*60*1000;
   while(!stop.get()&&System.currentTimeMillis()<deadline){JSONObject task=store.next(System.currentTimeMillis());if(task==null)break;String id=task.getString("taskId");
    int attempts=task.optInt("attempts")+1;
    store.update(id,new JSONObject().put("state","transferring").put("attempts",attempts).put("startedAt",System.currentTimeMillis()).put("error","").put("phase","Checking authenticated workspace"));
    try{String hash=transfer(task,store,stop);check(stop);store.update(id,new JSONObject().put("state","ready").put("phase","Confirmed by SHA-256 and size").put("hash",hash).put("base",hash).put("loaded",task.getLong("size")).put("total",task.getLong("size")).put("finishedAt",System.currentTimeMillis()).put("retryAt",Long.MAX_VALUE));}
    catch(Exception failure){boolean terminal=failure instanceof Blocked;store.update(id,new JSONObject().put("state",stop.get()?"pending":"failed").put("phase",stop.get()?"Interrupted; retry queued":"Transfer failed; bytes not confirmed").put("error",safeError(failure)).put("retryAt",terminal?Long.MAX_VALUE:System.currentTimeMillis()+Math.min(3600000L,30000L*(1L<<Math.min(attempts-1,7)))));}
   }
   retry=store.retryPending();
  }catch(Exception failure){android.util.Log.e("SpireMedia","Durable queue unavailable: "+failure.getClass().getSimpleName());}
  final boolean again=retry;if(!stop.get())new android.os.Handler(getMainLooper()).post(()->{if(!stop.get())jobFinished(parameters,again);});});return true;
 }
 @Override public boolean onStopJob(JobParameters parameters){stopped.set(true);return true;}
 private static void check(AtomicBoolean stop)throws Exception{if(stop.get())throw new InterruptedIOException("Android interrupted transfer; retry queued");}
 private static class Blocked extends IOException{Blocked(String message){super(message);}}
 private static String safeError(Exception error){return error instanceof IOException?error.getMessage():"Transfer failed ["+error.getClass().getSimpleName()+"]. Retry retained.";}
 private JSONObject request(JSONObject task,String path,String method,JSONObject headers,byte[] bytes,AtomicBoolean stop)throws Exception{
  check(stop);JSONObject r=new JSONObject().put("origin",task.getString("origin")).put("path",path).put("method",method).put("headers",headers==null?new JSONObject():headers);if(bytes!=null)r.put("body",Base64.encodeToString(bytes,Base64.NO_WRAP)).put("binary",true);
  JSONObject response=RemoteTransport.request(getApplicationContext(),r);check(stop);int status=response.getInt("status");if(status==401||status==403)throw new Blocked("Sign in to resume background transfers");if(status<200||status>=300)throw new IOException("Server attachment request HTTP "+status);return response;
 }
 private JSONObject json(JSONObject response)throws Exception{return new JSONObject(new String(Base64.decode(response.getString("body"),Base64.DEFAULT),StandardCharsets.UTF_8));}
 private String transfer(JSONObject task,MediaQueueStore store,AtomicBoolean stop)throws Exception{
  JSONObject me=json(request(task,"/api/me","GET",null,null,stop));JSONObject device=me.optJSONObject("device");
  if(!task.getString("account").equals(me.optString("owner"))||device==null||!task.getString("device").equals(device.optString("id")))throw new Blocked("Account or device changed; reconnect before retrying");
  LocalFolder folder=LocalFolder.open(getApplicationContext(),Uri.parse(task.getString("tree")));
  if(!folder.origin.equals(task.getString("workspace")))throw new Blocked("Local workspace changed; transfer stopped");
  String path=task.getString("path"),query="?path="+Uri.encode(path)+"&workspace="+Uri.encode(task.getString("workspace"));
  JSONObject headers=new JSONObject().put("Content-Type","application/octet-stream").put("X-CSRF-Token",me.getString("csrf"));
  return MediaTransfer.run(new MediaTransfer.Backend(){
   public byte[] local()throws Exception{check(stop);return folder.mediaBytes(path);}
   public MediaTransfer.Info info()throws Exception{JSONObject value=json(request(task,"/api/device-workspaces/self/attachment-info"+query,"GET",null,null,stop));return new MediaTransfer.Info(value.getString("hash"),value.getLong("size"),value.optBoolean("deleted"));}
   public byte[] download()throws Exception{return Base64.decode(request(task,"/api/device-workspaces/self/attachment"+query,"GET",null,null,stop).getString("body"),Base64.DEFAULT);}
   public void upload(byte[] bytes,String hash,String expected)throws Exception{check(stop);JSONObject receipt=json(request(task,"/api/device-workspaces/self/attachment"+query+"&hash="+hash+"&base="+expected,"PUT",headers,bytes,stop));if(!hash.equals(receipt.optString("hash")))throw new IOException("Server upload receipt differs");}
   public void save(byte[] bytes,String expected)throws Exception{check(stop);folder.saveMedia(path,bytes,expected);}
  },task.optString("base",null),task.getLong("size"),(direction,phase)->{check(stop);store.update(task.getString("taskId"),new JSONObject().put("direction",direction).put("phase",phase).put("total",task.getLong("size")));});
 }
}
