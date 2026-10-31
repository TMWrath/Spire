package com.tmwrath.spire;
import java.security.MessageDigest;
import java.util.Locale;
import java.io.IOException;
final class MediaTransfer {
 static final class Info {final String hash;final long size;final boolean deleted;Info(String h,long s,boolean d){hash=h;size=s;deleted=d;}}
 interface Backend {byte[] local()throws Exception;Info info()throws Exception;byte[] download()throws Exception;void upload(byte[] bytes,String hash,String expected)throws Exception;void save(byte[] bytes,String expected)throws Exception;}
 interface Progress {void update(String direction,String phase)throws Exception;}
 static String hash(byte[] bytes)throws Exception{if(bytes==null)return "missing";StringBuilder text=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))text.append(String.format(Locale.ROOT,"%02x",b));return text.toString();}
 static String run(Backend backend,String base,long expectedSize,Progress progress)throws Exception{
  progress.update("checking","Reading Local bytes");byte[] local=backend.local();String localHash=hash(local);Info info=backend.info();
  if(info.deleted)throw new IOException("Server attachment was deleted; stale transfer cancelled");
  if(!info.hash.matches("missing|[a-f0-9]{64}")||info.size<0||info.size>32*1024*1024)throw new IOException("Invalid Server attachment receipt");
  String direction=MediaReconciler.direction(localHash,info.hash,base);
  if(direction.equals("ready"))return localHash;
  if(direction.equals("download")){
   if(info.size!=expectedSize)throw new IOException("Server attachment size changed; retry synchronization");
   progress.update(direction,"Downloading Server bytes");byte[] bytes=backend.download();
   if(bytes==null||bytes.length!=info.size||!hash(bytes).equals(info.hash))throw new IOException("Server attachment hash or size differs");
   Info fresh=backend.info();if(fresh.deleted||!fresh.hash.equals(info.hash))throw new IOException("Server attachment changed; stale download cancelled");
   progress.update(direction,"Saving verified Local bytes");backend.save(bytes,localHash);
   if(!hash(backend.local()).equals(info.hash))throw new IOException("Local attachment readback differs");
   return info.hash;
  }
  if(direction.equals("upload")){
   if(local==null||local.length!=expectedSize)throw new IOException("Local attachment size changed; retry synchronization");
   progress.update(direction,"Uploading Local bytes");backend.upload(local,localHash,info.hash);
   Info receipt=backend.info();if(receipt.deleted||receipt.size!=local.length||!receipt.hash.equals(localHash))throw new IOException("Server upload not confirmed");
   return localHash;
  }
  throw new IOException(direction.equals("conflict")?"Attachment conflict: both copies retained":"Attachment bytes unavailable");
 }
}
