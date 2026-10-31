package com.tmwrath.spire;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Canonical Spire editor with independent SAF-local and HTTPS-server workspaces. */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 10, SAVE_FILE = 11, AUDIO_PERMISSION = 12, PICK_FOLDER = 13;
    private static final int MAX_DOWNLOAD = 32 * 1024 * 1024;
    static final int REMOTE_MESSAGE_CHUNK = 128 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ExecutorService remoteIO = Executors.newSingleThreadExecutor();
    private final RemoteRequestLanes remoteLanes = new RemoteRequestLanes();
    private LinearLayout root, body;
    private TextView error;
    private Button recovery;
    private ProgressBar progress;
    private WebView web;
    private String server;
    private LocalFolder localFolder;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest microphone;
    private byte[] pendingDownload;
    private boolean downloadBusy;
    private int connectionAttempt;

    static java.util.List<String> remoteMessages(JSONObject response) {
        String payload=response.toString();
        if(payload.length()<=REMOTE_MESSAGE_CHUNK)return Collections.singletonList(payload);
        java.util.List<String> messages=new java.util.ArrayList<>();
        int total=(payload.length()+REMOTE_MESSAGE_CHUNK-1)/REMOTE_MESSAGE_CHUNK;
        long id=response.optLong("id",-1);
        for(int index=0;index<total;index++){
            int start=index*REMOTE_MESSAGE_CHUNK,end=Math.min(payload.length(),start+REMOTE_MESSAGE_CHUNK);
            JSONObject chunk=new JSONObject();
            try{chunk.put("id",id).put("index",index).put("total",total).put("part",payload.substring(start,end));}
            catch(Exception impossible){throw new IllegalStateException(impossible);}
            messages.add(chunk.toString());
        }
        return messages;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Local ↔ Server attachment publication is temporarily disabled. Retained work stays on disk.
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(16,16,16));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        recovery = new Button(this); recovery.setText("Server connection"); recovery.setVisibility(View.GONE);
        recovery.setOnClickListener(v -> appAction("connection")); root.addView(recovery);
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal); progress.setMax(100);
        root.addView(progress,new LinearLayout.LayoutParams(-1,dp(2))); progress.setVisibility(View.GONE);
        error = text("",14); error.setPadding(dp(12),dp(8),dp(12),dp(8)); error.setVisibility(View.GONE); root.addView(error);
        body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
        server = getPreferences(MODE_PRIVATE).getString("server",null);
        String tree=getPreferences(MODE_PRIVATE).getString("localTree",null);
        if("local".equals(getPreferences(MODE_PRIVATE).getString("workspaceMode","server"))&&tree!=null){openLocal(Uri.parse(tree));return;}
        if (server == null) showConnection(); else {
            try { server = ServerAddress.normalize(server); openServer(state); }
            catch (IllegalArgumentException invalid) { server = null; showConnection(); }
        }
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value,int size) { TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(Color.WHITE); return v; }
    private void message(String value) { if (!isDestroyed()) Toast.makeText(this,value,Toast.LENGTH_LONG).show(); }
    private void failure(String value) { error.setText(value + "  •  Tap here to retry"); error.setVisibility(View.VISIBLE); recovery.setVisibility(View.VISIBLE); error.setOnClickListener(v -> { if(web!=null) web.reload(); }); }
    private void guardEditorExit(String action,Runnable proceed) {
        if(web==null){proceed.run();return;}
        web.evaluateJavascript("(()=>{const e=new CustomEvent('spire-request-leave',{cancelable:true,detail:"+JSONObject.quote(action)+"});return window.dispatchEvent(e);})()",allowed->{if("true".equals(allowed))proceed.run();});
    }
    private void appAction(String action) {
        if (web == null) return;
        if ("reload".equals(action)) {
            new AlertDialog.Builder(this).setTitle("Reload Spire?").setMessage("Wait for Spire to finish saving first. Unsaved editor text may be lost on reload.").setNegativeButton("Cancel",null).setPositiveButton("Reload",(d,w)->guardEditorExit("reload-confirmed",()->{if(web!=null)web.reload();})).show();
        } else if ("print".equals(action)) {
            try { ((PrintManager)getSystemService(PRINT_SERVICE)).print("Spire",web.createPrintDocumentAdapter("Spire"),null); }
            catch (Exception unavailable) { message("Android printing is unavailable."); }
        } else if ("connection".equals(action)) {
            new AlertDialog.Builder(this).setTitle("Workspaces").setMessage((localFolder==null?server:"Local folder") + "\n\nWait for saving to finish before switching. Each local folder and server keeps separate drafts. Nothing is automatically uploaded or synchronized between workspaces.").setNegativeButton("Stay",null).setPositiveButton("Change workspace",(d,w)->guardEditorExit("connection-confirmed",()->showConnection())).show();
        } else if ("about".equals(action)) {
            new AlertDialog.Builder(this).setTitle("Spire for Android · " + BuildConfig.VERSION_NAME).setMessage("T.M. Wrath\n\nThe canonical Spire editor, bundled for offline local folders or connected to your HTTPS Docker server. Local files are written through Android folder permissions. Workspaces are separate, not automatic synchronization. Local folders: up to 32 MiB including history, 10000 entries. Interrupted saves retain a recovery journal.\n\nDownloads up to 32 MiB. Keep Android System WebView up to date.").setPositiveButton("Close",null).show();
        }
    }
    private void rememberServer(String address) {
        server=address;
        getPreferences(MODE_PRIVATE).edit().putString("server",server).apply();
    }
    private void showConnection() {
        connectionAttempt++;
        if (web != null) { cancelWebRequests(); body.removeView(web); web.destroy(); web=null; }
        localFolder=null;server=getPreferences(MODE_PRIVATE).getString("server",null);
        body.removeAllViews(); progress.setVisibility(View.GONE); error.setVisibility(View.GONE); recovery.setVisibility(View.GONE);
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(24),dp(40),dp(24),dp(24));
        form.addView(text("Your writing. On your device.",28));
        form.addView(text("Choose or create a folder in the Android folder picker to start writing. No account, server or internet connection required.",16));
        Button folder=new Button(this);folder.setText("Open local folder");folder.setOnClickListener(v->{try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION),PICK_FOLDER);}catch(Exception unavailable){message("No folder picker available.");}});form.addView(folder);
        String lastTree=getPreferences(MODE_PRIVATE).getString("localTree",null);if(lastTree!=null){Button recent=new Button(this);recent.setText("Reopen local folder");recent.setOnClickListener(v->openLocal(Uri.parse(lastTree)));form.addView(recent);}
        form.addView(text("Your Markdown files and attachments stay in your chosen folder. A server is optional, and local files are never automatically uploaded.",14));
        Button optional=new Button(this);optional.setText("Connect to a server (optional)");form.addView(optional);
        LinearLayout serverForm=new LinearLayout(this);serverForm.setOrientation(LinearLayout.VERTICAL);serverForm.setVisibility(View.GONE);form.addView(serverForm);
        optional.setOnClickListener(v->{boolean opening=serverForm.getVisibility()!=View.VISIBLE;serverForm.setVisibility(opening?View.VISIBLE:View.GONE);optional.setText(opening?"Hide server setup":"Connect to a server (optional)");});
        TextView explanation = text("Your server. Your files. The same Spire.\n\nEnter your HTTPS server address, then sign in with your Spire account.",16); explanation.setPadding(0,dp(16),0,dp(24)); serverForm.addView(explanation);
        EditText address = new EditText(this); address.setSingleLine(true); address.setTextColor(Color.WHITE); address.setHintTextColor(Color.LTGRAY); address.setHint("https://your-spire-server.example"); address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI); address.setText(server == null ? "" : server); serverForm.addView(address);
        TextView status = text("",14); serverForm.addView(status);
        Button connect = new Button(this); connect.setText("Connect"); serverForm.addView(connect);
        connect.setOnClickListener(v -> {
            final String candidate;
            try { candidate = ServerAddress.normalize(address.getText().toString()); } catch(IllegalArgumentException e) { status.setText(e.getMessage()); return; }
            connect.setEnabled(false); status.setText("Checking server…"); int attempt = ++connectionAttempt;
            io.execute(() -> {
                String issue=null;
                try {
                    HttpURLConnection c = connection(candidate + "/api/health");
                    try { if(c.getResponseCode()!=200) throw new Exception("Health check failed");
                        String type=c.getContentType(); if(type==null || !type.toLowerCase(java.util.Locale.ROOT).contains("application/json")) throw new Exception("Not a Spire health response");
                        JSONObject health=new JSONObject(new String(readLimited(c.getInputStream(),65536),StandardCharsets.UTF_8));
                        if(!health.optBoolean("ok",false)) throw new Exception("Server is not ready");
                    } finally { c.disconnect(); }
                } catch(Exception e) { issue="Could not connect. Check the address, connection, server availability and trusted HTTPS certificate."; }
                final String result=issue;
                runOnUiThread(() -> { if(isDestroyed() || attempt!=connectionAttempt)return; connect.setEnabled(true); if(result!=null) {status.setText(result);return;} rememberServer(candidate);openServer(null); });
            });
        });
        if(server!=null) { Button cancel=new Button(this);cancel.setText("Return to connected server");cancel.setOnClickListener(v->{connectionAttempt++;openServer(null);});form.addView(cancel); }
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);scroll.addView(form);body.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
    }
    private void leaveRecoveryPrompt() {
        if(web==null)showConnection();
    }
    private void showRecoveryFailure(String reason) {
        progress.setIndeterminate(false);
        if(web==null)showConnection();
        progress.setVisibility(View.GONE);
        error.setText("Recovery remains protected: "+reason+"\nThe journal and queued content were kept. Recovery was not acknowledged. Reopen the local folder to review it again.");
        error.setOnClickListener(null);error.setVisibility(View.VISIBLE);
    }
    private void openLocal(Uri tree) {
        try {
            if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))throw new Exception("Update Android System WebView to open local folders.");
            if(!getPreferences(MODE_PRIVATE).getBoolean("nativeDeviceStateMigratedV1",false)){
                LegacyDeviceMigration.start(this,remoteIO,()->{if(!isDestroyed()){getPreferences(MODE_PRIVATE).edit().putBoolean("nativeDeviceStateMigratedV1",true).commit();openLocal(tree);}},failure->{if(!isDestroyed()){showConnection();message(failure);}});
                return;
            }
            LocalFolder selected=LocalFolder.open(this,tree);
            // Manual Local does not run the legacy recovery workflow.
            connectionAttempt++;
            if(web!=null){cancelWebRequests();body.removeView(web);web.destroy();web=null;}
            localFolder=selected;server=selected.origin;
            getPreferences(MODE_PRIVATE).edit().putString("localTree",tree.toString()).putString("workspaceMode","local").apply();openServer(null);
        }catch(Exception unavailable){showConnection();message(unavailable.getMessage());}
    }
    @SuppressLint("SetJavaScriptEnabled") private void openServer(Bundle saved) {
        body.removeAllViews();error.setVisibility(View.GONE);recovery.setVisibility(View.GONE);
        final LocalFolder folder=localFolder;
        web=new WebView(this); if(BuildConfig.DEBUG)WebView.setWebContentsDebuggingEnabled(true); web.setBackgroundColor(Color.rgb(16,16,16));
        WebSettings settings=web.getSettings(); settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(true);settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString()+" SpireAndroid/"+BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                if(folder==null)return null;
                try {String range=null;for(java.util.Map.Entry<String,String> h:request.getRequestHeaders().entrySet())if("Range".equalsIgnoreCase(h.getKey()))range=h.getValue();return folder.resource(request.getUrl(),range);}catch(Exception unavailable){return LocalFolder.blocked();}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                String url=request.getUrl().toString();
                if(ServerAddress.sameOrigin(server,url))return false;
                if(request.isForMainFrame() && request.hasGesture()) external(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { progress.setVisibility(View.VISIBLE);error.setVisibility(View.GONE);recovery.setVisibility(View.GONE); }
            @Override public void onPageFinished(WebView view,String url) { progress.setVisibility(View.GONE);CookieManager.getInstance().flush();installDownloadHandler(); }
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError err) { if(req.isForMainFrame())failure("Unable to load Spire. Check your connection or change servers using Server connection."); }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest req,android.webkit.WebResourceResponse response) { if(req.isForMainFrame())failure("Server returned HTTP "+response.getStatusCode()+"."); }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError ssl) { handler.cancel();failure("HTTPS certificate could not be verified. Connection blocked."); }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            if(folder!=null)WebViewCompat.addWebMessageListener(web,"SpireFolder",Collections.singleton(folder.origin),(view,msg,origin,mainFrame,reply)->{
                if(view!=web||folder!=localFolder||!AppActions.trusted(folder.origin,origin.toString(),mainFrame)||msg.getType()!=androidx.webkit.WebMessageCompat.TYPE_STRING)return;
                final String raw=msg.getData();if(raw==null||raw.length()>100*1024*1024)return;
                io.execute(()->{JSONObject response=new JSONObject();try{JSONObject request=new JSONObject(raw);response.put("id",request.getString("id"));String op=request.getString("op");if(op.equals("location"))response.put("value",folder.location());else if(op.equals("browse"))response.put("value",folder.openDirectory());else if(op.equals("list"))response.put("value",folder.listDirectory(request.getString("path")));else if(op.equals("load"))response.put("value",request.optBoolean("indexed",false)?folder.openIndexed():folder.load());else if(op.equals("text"))response.put("value",folder.readText(request.getString("path")));else if(op.equals("reference"))response.put("value",folder.attachmentReference(request.getString("path")));else if(op.equals("read"))response.put("value",folder.readAttachment(request.getString("path"),request.getJSONObject("reference")));else if(op.equals("commit")){folder.commit(request.getJSONObject("before"),request.getJSONObject("after"));response.put("value",true);}else throw new Exception("Unknown local action");}catch(Exception failure){try{response.put("error",failure.getMessage()==null?"Folder unavailable":failure.getMessage());}catch(Exception ignored){}}final String serialized=response.toString();runOnUiThread(()->{if(view==web&&folder==localFolder&&!isDestroyed())reply.postMessage(serialized);});});
            });
            if(folder!=null)WebViewCompat.addWebMessageListener(web,"SpireMedia",Collections.singleton(folder.origin),(view,msg,origin,mainFrame,reply)->{
                if(view!=web||folder!=localFolder||!AppActions.trusted(folder.origin,origin.toString(),mainFrame)||msg.getType()!=androidx.webkit.WebMessageCompat.TYPE_STRING)return;
                final String raw=msg.getData();if(raw==null||raw.length()>2*1024*1024)return;
                remoteIO.execute(()->{JSONObject response=new JSONObject();try{JSONObject request=new JSONObject(raw);response.put("id",request.getLong("id"));MediaQueueStore store=new MediaQueueStore(getApplicationContext());String action=request.getString("action");
                    if(action.equals("enqueue")){JSONObject input=request.getJSONObject("input");if(!folder.origin.equals(input.getString("workspace")))throw new Exception("Workspace mismatch");String target=ServerAddress.normalize(input.getString("origin"));org.json.JSONArray attachments=input.getJSONArray("attachments");if(attachments.length()>10000)throw new Exception("Too many attachments");JSONObject tasks=new JSONObject();
                        for(int i=0;i<attachments.length();i++){JSONObject attachment=attachments.getJSONObject(i);String path=attachment.getString("path");LocalFolder.mediaPath(path);long size=attachment.getLong("size");if(size<0||size>32*1024*1024)throw new Exception("Attachment exceeds 32 MiB");JSONObject task=new JSONObject().put("tree",folder.treeUri()).put("origin",target).put("workspace",folder.origin).put("device",input.getString("device")).put("account",input.getString("account")).put("path",path).put("size",size);String base=attachment.optString("base","");if(base.matches("missing|[a-f0-9]{64}"))task.put("base",base);tasks.put(path,store.enqueue(task));}
                        MediaTransferJob.schedule(getApplicationContext());response.put("value",new JSONObject().put("tasks",tasks));
                    }else if(action.equals("status"))response.put("value",store.status(request.getString("taskId"),folder.treeUri()));else throw new Exception("Unknown media action");
                }catch(Exception failure){try{response.put("error","Background transfer unavailable ["+failure.getClass().getSimpleName()+"]. Files retained.");}catch(Exception ignored){}}
                final String serialized=response.toString();runOnUiThread(()->{if(view==web&&folder==localFolder&&!isDestroyed())reply.postMessage(serialized);});});
            });
            final BridgeChunks remoteChunks=new BridgeChunks();
            if(folder!=null)WebViewCompat.addWebMessageListener(web,"SpireRemote",Collections.singleton(folder.origin),(view,msg,origin,mainFrame,reply)->{
                if(view!=web||folder!=localFolder||!AppActions.trusted(folder.origin,origin.toString(),mainFrame)||msg.getType()!=androidx.webkit.WebMessageCompat.TYPE_STRING)return;
                String raw=msg.getData();if(raw==null||raw.length()>64*1024*1024)return;
                remoteIO.execute(()->{
                    JSONObject response=new JSONObject();
                    java.util.function.Consumer<JSONObject> deliver=result->{java.util.List<String> messages=remoteMessages(result);runOnUiThread(()->{if(view==web&&folder==localFolder&&!isDestroyed())for(String message:messages)reply.postMessage(message);});};
                    try {
                        JSONObject envelope=new JSONObject(raw);response.put("id",envelope.getLong("id"));
                        final JSONObject request=remoteChunks.accept(envelope);if(request==null)return;
                        remoteLanes.execute(request,()->{
                            try{response.put("value","device-state".equals(request.optString("operation"))?DeviceState.response(getApplicationContext(),request):RemoteTransport.request(getApplicationContext(),request));}
                            catch(Exception failure){try{response.put("error","Server request failed ["+failure.getClass().getSimpleName()+"]. Local files remain unchanged; upload is not confirmed.");}catch(Exception ignored){}}
                            deliver.accept(response);
                        });
                    }catch(Exception failure){try{response.put("error","Server request failed ["+failure.getClass().getSimpleName()+"]. Local files remain unchanged; upload is not confirmed.");}catch(Exception ignored){}deliver.accept(response);}
                });
            });
            WebViewCompat.addWebMessageListener(web,"SpireApp",Collections.singleton(server),(view,msg,origin,mainFrame,reply)->{
                if(view!=web || !AppActions.trusted(server,origin.toString(),mainFrame))return;
                if(msg.getType()!=androidx.webkit.WebMessageCompat.TYPE_STRING)return;
                String action=msg.getData(); if(!AppActions.allowed(action))return;
                if("info".equals(action)) {
                    try { JSONObject info=new JSONObject();info.put("version",BuildConfig.VERSION_NAME);info.put("server",server);reply.postMessage(info.toString()); }
                    catch(Exception invalid){message("Android app details unavailable.");}
                } else if("folder-confirmed".equals(action)){startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION),PICK_FOLDER);} else if("leave".equals(action)){moveTaskToBack(true);} else if("reload-confirmed".equals(action)){if(web!=null)web.reload();} else if("connection-confirmed".equals(action)){showConnection();} else appAction(action);
            });
            WebViewCompat.addWebMessageListener(web,"SpireDownloads",Collections.singleton(server),(view,msg,origin,mainFrame,reply)->{
                if(view!=web || !mainFrame || !ServerAddress.sameOrigin(server,origin.toString()))return;
                try {
                    String raw=msg.getData();if(raw==null || raw.length()>MAX_DOWNLOAD*4/3+4096)throw new Exception();
                    JSONObject data=new JSONObject(raw);
                    if(data.has("error")) {message("Export could not be read or exceeds the 32 MiB limit.");return;}
                    String encoded=data.getString("data");byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
                    if(bytes.length>MAX_DOWNLOAD)throw new Exception();
                    prepareSave(bytes,data.optString("name","download"),data.optString("mime","application/octet-stream"));
                } catch(Exception e) { message("Could not export this file."); }
            });
        }
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view,int value) {progress.setProgress(value);if(value==100)progress.setVisibility(View.GONE);}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                try { Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_FILE); }
                catch(Exception e) {fileCallback.onReceiveValue(null);fileCallback=null;message("No file picker available.");}return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                if(!ServerAddress.sameOrigin(server,request.getOrigin().toString())) {request.deny();return;}
                boolean audio=false;for(String resource:request.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))audio=true;
                if(!audio){request.deny();return;}
                if(microphone!=null)microphone.deny();microphone=request;
                // Android owns persistent microphone consent. Only the selected Spire origin
                // can use it; never show internal workspace hosts as user-facing identity.
                if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)grantMicrophone();
                else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION);
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {if(microphone==request)microphone=null;}
            @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean gesture,android.os.Message result) {
                if(!gesture)return false;
                WebView popup=new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){external(req.getUrl());v.destroy();return true;}});
                ((WebView.WebViewTransport)result.obj).setWebView(popup);result.sendToTarget();return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length)->{
            if(url.startsWith("blob:")) {exportBlob(url,"download");return;}
            if(!ServerAddress.sameOrigin(server,url)){message("Downloads must come from the connected Spire server.");return;}
            if(downloadBusy || pendingDownload!=null){message("Finish the current download first.");return;}
            if(folder!=null){downloadBusy=true;io.execute(()->{try{android.webkit.WebResourceResponse resource=folder.resource(Uri.parse(url));if(resource.getStatusCode()!=200)throw new Exception();byte[] bytes=readLimited(resource.getData(),MAX_DOWNLOAD);String name=Uri.parse(url).getQueryParameter("path");runOnUiThread(()->{downloadBusy=false;prepareSave(bytes,name==null?"attachment":name.substring(name.lastIndexOf('/')+1),resource.getMimeType());});}catch(Exception unavailable){runOnUiThread(()->{downloadBusy=false;message("Local attachment unavailable.");});}});return;}
            downloadBusy=true;String cookie=CookieManager.getInstance().getCookie(url);
            io.execute(()->{
                try {HttpURLConnection c=connection(url);try {if(cookie!=null)c.setRequestProperty("Cookie",cookie);c.setRequestProperty("User-Agent",agent);
                    if(c.getResponseCode()!=200)throw new Exception();byte[] bytes=readLimited(c.getInputStream(),MAX_DOWNLOAD);
                    String name=android.webkit.URLUtil.guessFileName(url,disposition,mime);
                    runOnUiThread(()->{downloadBusy=false;prepareSave(bytes,name,mime);});
                }finally{c.disconnect();}}
                catch(Exception e){runOnUiThread(()->{downloadBusy=false;message("Download failed or exceeds 32 MiB. Please retry.");});}
            });
        });
        body.addView(web,new LinearLayout.LayoutParams(-1,-1));
        if(saved==null || web.restoreState(saved)==null)web.loadUrl(server+"/");
    }
    private void external(Uri uri) {
        String scheme=uri.getScheme();if(!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme)&&!"mailto".equalsIgnoreCase(scheme)){message("This link type is not supported.");return;}
        new AlertDialog.Builder(this).setTitle("Open external link?").setMessage(uri.toString()).setNegativeButton("Cancel",null).setPositiveButton("Open",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception e){message("No app can open this link.");}}).show();
    }
    private void grantMicrophone() {if(microphone!=null){if(ServerAddress.sameOrigin(server,microphone.getOrigin().toString()))microphone.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else microphone.deny();microphone=null;}}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {super.onRequestPermissionsResult(request,permissions,results);if(request==AUDIO_PERMISSION && microphone!=null){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)grantMicrophone();else{microphone.deny();microphone=null;message("Microphone permission denied. Enable it in Android app settings to record.");}}}
    private static HttpURLConnection connection(String url) throws Exception {HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);return c;}
    private static byte[] readLimited(InputStream source,int limit) throws Exception {try(InputStream in=source;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n,total=0;while((n=in.read(buffer))!=-1){total+=n;if(total>limit)throw new Exception("Too large");out.write(buffer,0,n);}return out.toByteArray();}}
    private void installDownloadHandler() {
        if(web==null || !ServerAddress.sameOrigin(server,web.getUrl()))return;
        try { web.evaluateJavascript(new String(readLimited(getAssets().open("downloads.js"),65536),StandardCharsets.UTF_8),null); }
        catch(Exception e) { message("Download integration could not be loaded."); }
    }
    private void exportBlob(String url,String name) {if(web!=null && ServerAddress.sameOrigin(server,web.getUrl()))web.evaluateJavascript("window.__spireExport?window.__spireExport("+JSONObject.quote(url)+","+JSONObject.quote(name)+"):alert('Update Android System WebView to export files.')",null);}
    private void prepareSave(byte[] bytes,String name,String mime) {
        if(isDestroyed())return;if(pendingDownload!=null){message("Finish the current download first.");return;}pendingDownload=bytes;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime==null||mime.isEmpty()?"application/octet-stream":mime).putExtra(Intent.EXTRA_TITLE,ServerAddress.safeFilename(name));
        try{startActivityForResult(intent,SAVE_FILE);}catch(Exception e){pendingDownload=null;message("No save-file picker available.");}
    }
    @Override public void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==PICK_FOLDER&&result==RESULT_OK&&data!=null&&data.getData()!=null){try{int grant=data.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);if(grant!=(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION))throw new Exception("Folder requires read and write permission.");getContentResolver().takePersistableUriPermission(data.getData(),Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);openLocal(data.getData());}catch(Exception denied){message("Folder access was not granted. Your previous workspace is unchanged.");}}
        if(request==PICK_FILE&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
        if(request==SAVE_FILE){byte[] bytes=pendingDownload;pendingDownload=null;if(result==RESULT_OK&&bytes==null){message("Export interrupted when Android restarted Spire. Please export again; the selected destination may be empty.");return;}if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){Uri destination=data.getData();io.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(destination,"wt")){if(out==null)throw new Exception();out.write(bytes);runOnUiThread(()->message("File saved."));}catch(Exception e){runOnUiThread(()->message("Could not save file. Please retry the export."));}});}}
    }
    @Override public void onBackPressed() {
        if(web==null&&server!=null){connectionAttempt++;openServer(null);return;}
        if(web!=null){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog.mind-fullscreen-dialog[open]');if(!d){const e=new Event('spire-request-leave',{cancelable:true});return !window.dispatchEvent(e);}d.dispatchEvent(new Event('cancel',{cancelable:true}));return true;})()",closed->{if(!"true".equals(closed)){if(web!=null&&web.canGoBack())web.goBack();else moveTaskToBack(true);}});return;}
        // Keep the live editor intact when leaving rather than destroying unsaved text.
        moveTaskToBack(true);
    }
    @Override protected void onSaveInstanceState(Bundle state) {super.onSaveInstanceState(state);if(web!=null)web.saveState(state);}
    @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();}
    private void cancelWebRequests(){if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}if(microphone!=null){microphone.deny();microphone=null;}}
    @Override protected void onDestroy(){connectionAttempt++;cancelWebRequests();if(web!=null){body.removeView(web);web.destroy();web=null;}io.shutdown();remoteIO.shutdown();remoteLanes.close();super.onDestroy();}
}
