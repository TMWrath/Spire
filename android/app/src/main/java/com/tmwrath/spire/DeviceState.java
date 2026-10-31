package com.tmwrath.spire;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device-wide, encrypted, no-backup state. Never contains Local folder data.
 * The renderer can reach this only through the origin/main-frame scoped bridge.
 * Each acknowledged entry is durable; tombstones survive legacy migration.
 */
final class DeviceState {
 private static final Object LOCK=new Object();
 private final File directory;private final SecretKey key;
 DeviceState(Context context)throws Exception{this(new File(context.getNoBackupFilesDir(),"device-state-v1"),deviceKey());}
 DeviceState(File directory,SecretKey key)throws Exception{this.directory=directory;this.key=key;if(!directory.isDirectory()&&!directory.mkdirs())throw new Exception("Device storage unavailable");}
 private static SecretKey deviceKey()throws Exception{
  synchronized(LOCK){KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);String alias="spire-device-state-v1";
   if(ks.containsAlias(alias))return (SecretKey)ks.getKey(alias,null);
   KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
  }
 }
 static boolean allowed(String name){
  if("server-profile".equals(name)||"installation-identity".equals(name))return true;
  try{JSONArray s=new JSONArray(name);if(s.length()!=5||!"server".equals(s.getString(0)))return false;
   String origin=s.getString(1);if(!origin.startsWith("https://")||!ServerAddress.normalize(origin).equals(origin))return false;
   for(int i=2;i<5;i++)if(!(s.get(i) instanceof String)||s.getString(i).isEmpty())return false;return true;
  }catch(Exception invalid){return false;}
 }
 private AtomicFile file(String name)throws Exception{
  if(!allowed(name)&&!privateSession(name))throw new Exception("Device state key rejected");
  byte[] digest=MessageDigest.getInstance("SHA-256").digest(name.getBytes(StandardCharsets.UTF_8));StringBuilder hash=new StringBuilder();for(byte b:digest)hash.append(String.format(java.util.Locale.ROOT,"%02x",b));return new AtomicFile(new File(directory,hash+".bin"));
 }
 private JSONObject read(String name)throws Exception{
  AtomicFile f=file(name);if(!f.getBaseFile().exists()&&!new File(f.getBaseFile()+".bak").exists())return null;
  byte[] data;try(java.io.InputStream in=f.openRead()){data=readBounded(in);}
  if(data.length<29)throw new Exception("Device state damaged; original retained");
  byte[] iv=java.util.Arrays.copyOfRange(data,0,12);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
  return new JSONObject(new String(cipher.doFinal(data,12,data.length-12),StandardCharsets.UTF_8));
 }
 private static byte[] readBounded(java.io.InputStream in)throws Exception{java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>64*1024*1024)throw new Exception("Device state exceeds limit");out.write(b,0,n);}return out.toByteArray();}
 private void write(String name,JSONObject value)throws Exception{
  byte[] plain=value.toString().getBytes(StandardCharsets.UTF_8);if(plain.length>63*1024*1024)throw new Exception("Device state exceeds limit");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key);cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));byte[] encrypted=cipher.doFinal(plain);
  AtomicFile f=file(name);FileOutputStream out=null;try{out=f.startWrite();out.write(cipher.getIV());out.write(encrypted);f.finishWrite(out);}catch(Exception error){if(out!=null)f.failWrite(out);throw error;}
 }
 JSONObject handle(JSONObject request)throws Exception{
  synchronized(LOCK){String op=request.getString("op");
   if(!"import".equals(op)&&!allowed(request.getString("key")))throw new Exception("Device state key rejected");
   if("import".equals(op)){JSONObject entries=request.getJSONObject("entries");if(entries.length()>10000)throw new Exception("Too many migration entries");for(String name:FolderTransaction.keys(entries)){if(!allowed(name))throw new Exception("Device state key rejected");if(read(name)==null)write(name,new JSONObject().put("present",true).put("value",entries.get(name)));}return new JSONObject();}
   String name=request.getString("key");
   if("get".equals(op)){JSONObject result=read(name);return result==null?new JSONObject().put("present",false):result;}
   if("put".equals(op)){write(name,new JSONObject().put("present",true).put("value",request.get("value")));return new JSONObject();}
   if("delete".equals(op)){write(name,new JSONObject().put("present",false));return new JSONObject();}
   throw new Exception("Device state action rejected");
  }
 }
 private static boolean privateSession(String name){try{String origin=name.substring("private-session:".length());return name.startsWith("private-session:")&&origin.startsWith("https://")&&ServerAddress.normalize(origin).equals(origin);}catch(Exception invalid){return false;}}
 static String session(Context context,String origin)throws Exception{
  synchronized(LOCK){DeviceState store=new DeviceState(context);String name="private-session:"+origin;JSONObject saved=store.read(name);
   if(saved==null){String legacy=android.webkit.CookieManager.getInstance().getCookie(origin);String cookie="";if(legacy!=null)for(String part:legacy.split(";"))if(part.trim().startsWith("spire_session="))cookie=part.trim();saved=new JSONObject().put("cookie",cookie).put("expires",System.currentTimeMillis()+30L*24*3600*1000);store.write(name,saved);}
   return saved.optLong("expires",0)>System.currentTimeMillis()?saved.optString("cookie",""):"";
  }
 }
 static void acceptSession(Context context,String origin,String header)throws Exception{
  for(java.net.HttpCookie cookie:java.net.HttpCookie.parse(header))if("spire_session".equals(cookie.getName())){
   synchronized(LOCK){long age=cookie.getMaxAge(),expires=age==0?0:System.currentTimeMillis()+Math.min(age<0?30L*24*3600:age,30L*24*3600)*1000;new DeviceState(context).write("private-session:"+origin,new JSONObject().put("cookie",age==0?"":"spire_session="+cookie.getValue()).put("expires",expires));}
  }
 }
 static JSONObject response(Context context,JSONObject request)throws Exception{
  JSONObject result=new DeviceState(context).handle(request.getJSONObject("state"));
  return new JSONObject().put("status",200).put("type","application/json").put("body",Base64.encodeToString(result.toString().getBytes(StandardCharsets.UTF_8),Base64.NO_WRAP));
 }
}
