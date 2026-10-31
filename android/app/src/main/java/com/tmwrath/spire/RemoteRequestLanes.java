package com.tmwrath.spire;

import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Isolate slow binary transport from interactive document and session requests.
 * This is scheduling only: RemoteTransport still validates every origin/path/header. */
final class RemoteRequestLanes implements AutoCloseable {
 private final ExecutorService foreground=Executors.newSingleThreadExecutor();
 private final ExecutorService media=Executors.newSingleThreadExecutor();
 static boolean isMedia(JSONObject request){
  if("device-state".equals(request.optString("operation")))return false;
  String path=request.optString("path","").split("\\?",2)[0];
  return path.equals("/api/attachment")||path.equals("/api/attachments")||path.matches("/api/device-workspaces/[^/]+/attachment(?:-info)?");
 }
 void execute(JSONObject request,Runnable work){(isMedia(request)?media:foreground).execute(work);}
 @Override public void close(){foreground.shutdown();media.shutdown();}
}
