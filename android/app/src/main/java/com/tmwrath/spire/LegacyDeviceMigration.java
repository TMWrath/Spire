package com.tmwrath.spire;

import android.app.Activity;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewCompat;
import java.io.File;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Collections;
import org.json.JSONObject;

/** One-time, read-only legacy-origin inventory. No editor/runtime is mounted,
 * no login/network request runs, no Local files or old databases are deleted.
 * Only origins derived from this installation's known folder indexes are read.
 */
final class LegacyDeviceMigration {
 static void start(Activity activity,java.util.concurrent.Executor io,Runnable done,java.util.function.Consumer<String> failed){
  File[] indexes=new File(activity.getFilesDir(),"folder-indexes").listFiles((d,n)->n.matches("[a-f0-9]{64}\\.json"));
  if(indexes==null){done.run();return;}Arrays.sort(indexes,(a,b)->Long.compare(b.lastModified(),a.lastModified()));
  ArrayDeque<String> origins=new ArrayDeque<>();for(File f:indexes){String origin="https://w-"+f.getName().substring(0,40)+".spire.invalid";if(!origins.contains(origin))origins.add(origin);}
  migrateNext(activity,io,origins,done,failed);
 }
 @android.annotation.SuppressLint("SetJavaScriptEnabled") private static void migrateNext(Activity activity,java.util.concurrent.Executor io,ArrayDeque<String> origins,Runnable done,java.util.function.Consumer<String> failed){
  if(activity.isDestroyed())return;if(origins.isEmpty()){done.run();return;}String origin=origins.removeFirst();
  WebView view=new WebView(activity);view.getSettings().setJavaScriptEnabled(true);view.getSettings().setDomStorageEnabled(true);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);
  final BridgeChunks chunks=new BridgeChunks();
  final boolean[] finished={false};android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
  Runnable timeout=()->{if(!finished[0]){finished[0]=true;view.destroy();failed.accept("Connection migration timed out. Existing folders and sessions are retained; retry without clearing app data.");}};handler.postDelayed(timeout,30000);
  view.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));}});
  WebViewCompat.addWebMessageListener(view,"SpireMigration",Collections.singleton(origin),(v,msg,source,mainFrame,reply)->{
   if(v!=view||finished[0]||!AppActions.trusted(origin,source.toString(),mainFrame))return;
   final JSONObject assembled;try{assembled=chunks.accept(new JSONObject(msg.getData()));if(assembled==null)return;}catch(Exception invalid){timeout.run();return;}finished[0]=true;handler.removeCallbacks(timeout);
   io.execute(()->{try{JSONObject response=assembled;if(response.has("error"))throw new Exception("Legacy database unavailable");new DeviceState(activity).handle(new JSONObject().put("op","import").put("entries",response.getJSONObject("entries")));activity.runOnUiThread(()->{view.destroy();migrateNext(activity,io,origins,done,failed);});}catch(Exception error){activity.runOnUiThread(()->{view.destroy();failed.accept("Connection migration could not complete. Original browser storage is untouched; retry without clearing app data.");});}});
  });
  // No credentials are interpolated into HTML, logs, navigation or diagnostics.
  String script="(async()=>{const databases=await indexedDB.databases();if(!databases.some(d=>d.name==='spire-private-v1')){SpireMigration.postMessage(JSON.stringify({entries:{}}));return;}const d=await new Promise((ok,no)=>{const r=indexedDB.open('spire-private-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('blocked'));});if(!d.objectStoreNames.contains('cache'))throw Error('Missing cache');const tx=d.transaction('cache','readonly'),s=tx.objectStore('cache'),all=s.getAll(),keys=s.getAllKeys();await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error);});const entries={};for(let i=0;i<keys.result.length;i++){const k=keys.result[i];if(k==='server-profile'||k==='installation-identity'){entries[k]=all.result[i];continue;}try{const scope=JSON.parse(k);if(Array.isArray(scope)&&scope.length===5&&scope[0]==='server')entries[k]=all.result[i];}catch{}}d.close();const raw=JSON.stringify({id:1,entries}),total=Math.ceil(raw.length/(128*1024));if(total>512)throw Error('Migration exceeds limit');for(let index=0;index<total;index++)SpireMigration.postMessage(JSON.stringify({id:1,operation:'request-part',index,total,part:raw.slice(index*128*1024,(index+1)*128*1024)}));})().catch(()=>SpireMigration.postMessage(JSON.stringify({error:true})));";
  view.loadDataWithBaseURL(origin+"/","<!doctype html><meta charset=utf-8><script>"+script+"</script>","text/html","UTF-8",null);
 }
}
