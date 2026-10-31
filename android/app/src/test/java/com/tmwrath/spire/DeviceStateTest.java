package com.tmwrath.spire;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.json.JSONObject;
import java.io.File;
import java.nio.file.Files;
import javax.crypto.spec.SecretKeySpec;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DeviceStateTest {
 private File root;private javax.crypto.SecretKey key;private DeviceState store;
 @Before public void setup()throws Exception{root=Files.createTempDirectory("spire-device-state").toFile();key=new SecretKeySpec(new byte[32],"AES");store=new DeviceState(root,key);}
 private JSONObject request(String op,String name,Object value)throws Exception{JSONObject r=new JSONObject().put("op",op).put("key",name);if(value!=null)r.put("value",value);return store.handle(r);}
 @Test public void encryptedDurableAcrossInstances()throws Exception{
  request("put","installation-identity",new JSONObject().put("secret","secret-must-not-be-plaintext"));
  for(File file:root.listFiles())assertFalse(new String(Files.readAllBytes(file.toPath()),java.nio.charset.StandardCharsets.UTF_8).contains("secret-must-not-be-plaintext"));
  store=new DeviceState(root,key);assertEquals("secret-must-not-be-plaintext",request("get","installation-identity",null).getJSONObject("value").getString("secret"));
 }
 @Test public void migrationIsAdditiveAndSignoutCannotBeResurrected()throws Exception{
  JSONObject old=new JSONObject().put("server-profile",new JSONObject().put("account","old"));
  store.handle(new JSONObject().put("op","import").put("entries",old));request("delete","server-profile",null);
  store=new DeviceState(root,key);store.handle(new JSONObject().put("op","import").put("entries",old));assertFalse(request("get","server-profile",null).getBoolean("present"));
 }
 @Test public void rejectsLocalKeysAndKeepsAccountsSeparate()throws Exception{
  for(String name:new String[]{"current","local-manual-v2","../credentials","publication-consent","transfer:1","device-publication:1"}){assertFalse(DeviceState.allowed(name));try{request("put",name,"bad");fail("accepted Local key");}catch(Exception expected){}}
  String a="[\"server\",\"https://example.com\",\"a\",\"books\",\"cache\"]",b=a.replace("\"a\"","\"b\"");
  request("put",a,"pending A");request("put",b,"pending B");assertEquals("pending A",request("get",a,null).getString("value"));assertEquals("pending B",request("get",b,null).getString("value"));
 }
 @Test public void corruptionFailsClosedRatherThanLosingDrafts()throws Exception{
  request("put","server-profile","retained");File f=root.listFiles()[0];byte[] data=Files.readAllBytes(f.toPath());data[data.length-1]^=1;Files.write(f.toPath(),data);
  try{request("get","server-profile",null);fail("corruption ignored");}catch(Exception expected){}assertTrue(f.exists());
 }
}
