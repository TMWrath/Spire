package com.tmwrath.spire;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.EditText;
import android.widget.Button;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.Shadows;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class MainActivityTest {
 @Before public void reset() { RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().clear().commit(); }
 private static <T extends View> T find(View root,Class<T> type) { if(type.isInstance(root))return type.cast(root);if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++){T found=find(((ViewGroup)root).getChildAt(i),type);if(found!=null)return found;}return null; }
 @Test public void lostExportAfterProcessDeathShowsRecoveryMessage() {
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   c.get().onActivityResult(11,android.app.Activity.RESULT_OK,new android.content.Intent().setData(android.net.Uri.parse("content://test/export")));
   assertEquals("Export interrupted when Android restarted Spire. Please export again; the selected destination may be empty.",org.robolectric.shadows.ShadowToast.getTextOfLatestToast());
  }
 }
 private static Button button(View root,String label) {if(root instanceof Button && label.equals(((Button)root).getText().toString()))return (Button)root;if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++){Button b=button(((ViewGroup)root).getChildAt(i),label);if(b!=null)return b;}return null;}
 @Test public void folderPickerUsesPersistableTreeGrantAndCancelDoesNotChangeServer() {
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   Button local=button(c.get().getWindow().getDecorView(),"Open local folder");assertNotNull("Local workspace must be available",local);local.performClick();
   android.content.Intent intent=Shadows.shadowOf(c.get()).getNextStartedActivityForResult().intent;
   assertEquals(android.content.Intent.ACTION_OPEN_DOCUMENT_TREE,intent.getAction());assertTrue((intent.getFlags()&android.content.Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)!=0);
   c.get().onActivityResult(13,android.app.Activity.RESULT_CANCELED,null);assertNull(find(c.get().getWindow().getDecorView(),WebView.class));
  }
 }
 @Test public void firstLaunchOffersHostedServerWithoutLoadingIt() {
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   View root=c.get().getWindow().getDecorView();
   assertEquals("",find(root,EditText.class).getText().toString());
   assertEquals(View.GONE,((View)find(root,EditText.class).getParent()).getVisibility());
   assertNotNull(button(root,"Open local folder"));
   button(root,"Connect to a server (optional)").performClick();
   assertEquals(View.VISIBLE,((View)find(root,EditText.class).getParent()).getVisibility());
   assertNull(find(root,WebView.class));
  }
 }
 @Test public void selectingServerPreservesRememberedLocalFolderForNextLaunch() {
  android.content.SharedPreferences prefs=RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE);
  prefs.edit().putString("localTree","content://provider/tree/primary%3ADocuments").putString("workspaceMode","local").commit();
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   MainActivity activity=c.get();
   try {
    java.lang.reflect.Method remember=MainActivity.class.getDeclaredMethod("rememberServer",String.class);remember.setAccessible(true);remember.invoke(activity,"https://spire.example");
    assertEquals("local",prefs.getString("workspaceMode",null));
    assertEquals("content://provider/tree/primary%3ADocuments",prefs.getString("localTree",null));
   }catch(ReflectiveOperationException failure){throw new AssertionError(failure);}
  }
 }
 @Test public void rememberedServerLoadsExactHostedInterfaceWithSafeSettings() {
  RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("server","https://spire.example").commit();
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   WebView web=find(c.get().getWindow().getDecorView(),WebView.class);assertNotNull(web);
   assertEquals("https://spire.example/",Shadows.shadowOf(web).getLastLoadedUrl());
   assertTrue(web.getSettings().getJavaScriptEnabled());assertTrue(web.getSettings().getDomStorageEnabled());
   assertFalse(web.getSettings().getAllowFileAccess());assertFalse(web.getSettings().getAllowContentAccess());
   assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,web.getSettings().getMixedContentMode());
   assertTrue(web.getSettings().getUserAgentString().contains("SpireAndroid/" + BuildConfig.VERSION_NAME));
   Button recovery=find(c.get().getWindow().getDecorView(),Button.class);assertNotNull(recovery);assertEquals("Server connection",recovery.getText().toString());assertEquals(View.GONE,recovery.getVisibility());
  }
 }
 @Test public void nativeSettingsActionsRetainCancelAndServerRecovery() throws Exception {
  RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("server","https://spire.example").commit();
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
   MainActivity activity=c.get();View root=activity.getWindow().getDecorView();WebView web=find(root,WebView.class);
   java.lang.reflect.Method action=MainActivity.class.getDeclaredMethod("appAction",String.class);action.setAccessible(true);
   action.invoke(activity,"reload");android.app.AlertDialog dialog=org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();
   assertEquals("Cancel",dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE).getText().toString());dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE).performClick();assertSame(web,find(root,WebView.class));
   action.invoke(activity,"connection");dialog=org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();assertEquals("Stay",dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE).getText().toString());dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE).performClick();assertSame(web,find(root,WebView.class));
   java.lang.reflect.Method failure=MainActivity.class.getDeclaredMethod("failure",String.class);failure.setAccessible(true);failure.invoke(activity,"Offline");Button recovery=find(root,Button.class);assertEquals(View.VISIBLE,recovery.getVisibility());
   web.getWebViewClient().onPageFinished(web,"https://spire.example/");assertEquals(View.VISIBLE,recovery.getVisibility());
   final android.webkit.ValueCallback<String>[] guard=new android.webkit.ValueCallback[1];
   WebView guarded=new WebView(activity){@Override public void evaluateJavascript(String script,android.webkit.ValueCallback<String> result){assertTrue(script.contains("spire-request-leave"));guard[0]=result;}};
   android.view.ViewGroup parent=(android.view.ViewGroup)web.getParent();int position=parent.indexOfChild(web);parent.removeView(web);parent.addView(guarded,position);
   java.lang.reflect.Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);field.set(activity,guarded);
   recovery.performClick();dialog=org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE).performClick();
   Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertSame(guarded,find(root,WebView.class));assertNotNull(guard[0]);guard[0].onReceiveValue("false");assertSame(guarded,find(root,WebView.class));
   guard[0].onReceiveValue("true");Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertNull(find(root,WebView.class));assertNotNull(find(root,EditText.class));
  }
 }
 @Test public void keepingRecoveryFromBlankStartupReturnsToWorkspacePicker()throws Exception{
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity a=c.get();java.lang.reflect.Field body=MainActivity.class.getDeclaredField("body");body.setAccessible(true);((ViewGroup)body.get(a)).removeAllViews();
   java.lang.reflect.Method leave=MainActivity.class.getDeclaredMethod("leaveRecoveryPrompt");leave.setAccessible(true);leave.invoke(a);
   assertNotNull(button(a.getWindow().getDecorView(),"Open local folder"));assertNull(find(a.getWindow().getDecorView(),WebView.class));
  }
 }
 @Test public void recoveryFailureStaysVisibleWithUsableWorkspacePicker()throws Exception{
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity a=c.get();java.lang.reflect.Method failure=MainActivity.class.getDeclaredMethod("showRecoveryFailure",String.class);failure.setAccessible(true);failure.invoke(a,"External edit detected");
   java.lang.reflect.Field error=MainActivity.class.getDeclaredField("error");error.setAccessible(true);android.widget.TextView message=(android.widget.TextView)error.get(a);
   assertEquals(View.VISIBLE,message.getVisibility());assertTrue(message.getText().toString().contains("External edit detected"));assertTrue(message.getText().toString().contains("journal and queued content were kept"));assertNotNull(button(a.getWindow().getDecorView(),"Open local folder"));
  }
 }
 private static class AudioRequest extends android.webkit.PermissionRequest {
  final android.net.Uri origin;final String[] resources;boolean denied;String[] granted;
  AudioRequest(String origin,String... resources){this.origin=android.net.Uri.parse(origin);this.resources=resources;}
  @Override public android.net.Uri getOrigin(){return origin;}
  @Override public String[] getResources(){return resources;}
  @Override public void grant(String[] resources){granted=resources;}
  @Override public void deny(){denied=true;}
 }
 @Test public void grantedMicrophoneIsReusedWithoutPerRecordingDialogAndOtherOriginsStayBlocked(){
  RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("server","https://spire.example").commit();
  Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO);
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()){
   WebView web=find(c.get().getWindow().getDecorView(),WebView.class);
   for(int i=0;i<2;i++){
    AudioRequest request=new AudioRequest("https://spire.example/",android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE,android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE);
    web.getWebChromeClient().onPermissionRequest(request);
    assertArrayEquals(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE},request.granted);assertFalse(request.denied);
   }
   assertNull(org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog());
   AudioRequest foreign=new AudioRequest("https://untrusted.example",android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE);web.getWebChromeClient().onPermissionRequest(foreign);assertTrue(foreign.denied);assertNull(foreign.granted);
   AudioRequest video=new AudioRequest("https://spire.example/",android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE);web.getWebChromeClient().onPermissionRequest(video);assertTrue(video.denied);
  }
 }
 @Test public void remoteResponsesAreChunkedBelowBinderLimitsAndReassembleExactly() throws Exception {
  String payload="x".repeat(MainActivity.REMOTE_MESSAGE_CHUNK*3+17);
  org.json.JSONObject response=new org.json.JSONObject().put("id",42).put("value",new org.json.JSONObject().put("body",payload));
  java.util.List<String> messages=MainActivity.remoteMessages(response);assertTrue(messages.size()>3);
  StringBuilder joined=new StringBuilder();
  for(int i=0;i<messages.size();i++){org.json.JSONObject chunk=new org.json.JSONObject(messages.get(i));assertEquals(42,chunk.getLong("id"));assertEquals(i,chunk.getInt("index"));assertEquals(messages.size(),chunk.getInt("total"));assertTrue(messages.get(i).length()<MainActivity.REMOTE_MESSAGE_CHUNK+1024);joined.append(chunk.getString("part"));}
  assertEquals(response.toString(),joined.toString());
  org.json.JSONObject small=new org.json.JSONObject().put("id",7).put("value",true);assertEquals(java.util.Collections.singletonList(small.toString()),MainActivity.remoteMessages(small));
 }
 @Test public void invalidRememberedServerFallsBackToConnectionForm() {
  RuntimeEnvironment.getApplication().getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("server","http://untrusted.test").commit();
  try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {View root=c.get().getWindow().getDecorView();assertNotNull(find(root,EditText.class));assertNull(find(root,WebView.class));}
 }
 @Test public void launcherReusesOneActivityTask() throws Exception {
  android.content.pm.ActivityInfo info=RuntimeEnvironment.getApplication().getPackageManager().getActivityInfo(new android.content.ComponentName(RuntimeEnvironment.getApplication(),MainActivity.class),0);
  assertEquals(android.content.pm.ActivityInfo.LAUNCH_SINGLE_TASK,info.launchMode);
 }
}
