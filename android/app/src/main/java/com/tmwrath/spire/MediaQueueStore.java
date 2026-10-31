package com.tmwrath.spire;
import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** App-private durable work and receipts; never contains session cookies or passwords. */
final class MediaQueueStore {
 private static final Object LOCK=new Object();
 private final AtomicFile file;
 MediaQueueStore(Context context){file=new AtomicFile(new File(context.getFilesDir(),"media-transfer-queue.json"));}
 private JSONObject read()throws Exception{try{return new JSONObject(new String(file.readFully(),StandardCharsets.UTF_8));}catch(FileNotFoundException absent){return new JSONObject();}}
 private void save(JSONObject data)throws Exception{FileOutputStream out=null;try{out=file.startWrite();out.write(data.toString().getBytes(StandardCharsets.UTF_8));file.finishWrite(out);}catch(Exception e){if(out!=null)file.failWrite(out);throw e;}}
 private static String key(JSONObject task)throws Exception{JSONArray a=new JSONArray();for(String k:new String[]{"tree","origin","workspace","account","device","path"})a.put(task.getString(k));return a.toString();}
 String enqueue(JSONObject task)throws Exception{synchronized(LOCK){JSONObject data=read();String key=key(task);JSONObject old=data.optJSONObject(key);if(old!=null&&(old.optString("state").equals("pending")||old.optString("state").equals("transferring"))&&old.optLong("size")==task.getLong("size"))return old.getString("taskId");JSONObject next=new JSONObject(task.toString()).put("taskId",UUID.randomUUID().toString()).put("state","pending").put("phase","Queued for Android background transfer").put("queuedAt",System.currentTimeMillis()).put("attempts",0);if(old!=null&&old.has("base"))next.put("base",old.getString("base"));data.put(key,next);save(data);return next.getString("taskId");}}
 JSONObject get(String id)throws Exception{synchronized(LOCK){JSONObject data=read();for(Iterator<String> it=data.keys();it.hasNext();){JSONObject task=data.getJSONObject(it.next());if(id.equals(task.optString("taskId")))return task;}throw new IOException("Transfer no longer available");}}
 void update(String id,JSONObject patch)throws Exception{synchronized(LOCK){JSONObject data=read();for(Iterator<String> it=data.keys();it.hasNext();){String key=it.next();JSONObject task=data.getJSONObject(key);if(id.equals(task.optString("taskId"))){for(Iterator<String> p=patch.keys();p.hasNext();){String k=p.next();task.put(k,patch.get(k));}task.put("updatedAt",System.currentTimeMillis());save(data);return;}}throw new IOException("Transfer superseded");}}
 void recover()throws Exception{synchronized(LOCK){JSONObject data=read();for(Iterator<String> it=data.keys();it.hasNext();){JSONObject t=data.getJSONObject(it.next());if(t.optString("state").equals("transferring"))t.put("state","pending").put("phase","Interrupted; queued for retry");}save(data);}}
 JSONObject next(long now)throws Exception{synchronized(LOCK){JSONObject data=read();for(Iterator<String> it=data.keys();it.hasNext();){JSONObject t=data.getJSONObject(it.next());if(t.optString("state").equals("pending")||t.optString("state").equals("failed")&&t.optLong("retryAt",Long.MAX_VALUE)<=now)return t;}return null;}}
 boolean retryPending()throws Exception{synchronized(LOCK){JSONObject data=read();for(Iterator<String> it=data.keys();it.hasNext();){JSONObject t=data.getJSONObject(it.next());if(t.optString("state").equals("pending")||t.optString("state").equals("failed")&&t.optLong("retryAt",Long.MAX_VALUE)<Long.MAX_VALUE)return true;}return false;}}
 JSONObject status(String id,String tree)throws Exception{JSONObject t=get(id);if(!tree.equals(t.getString("tree")))throw new IOException("Workspace mismatch");JSONObject result=new JSONObject();for(String key:new String[]{"taskId","state","phase","direction","total","loaded","error","hash","queuedAt","startedAt","finishedAt","retryAt","attempts"})if(t.has(key))result.put(key,t.get(key));return result;}
 void clearForTest(){synchronized(LOCK){file.delete();}}
}
