package com.tmwrath.spire;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
public class MediaTransferTest {
 static byte[] bytes(String s){return s.getBytes(StandardCharsets.UTF_8);}
 static class Disk implements MediaTransfer.Backend {
  byte[] local,remote;int uploads,downloads;boolean corrupt,saveFails;
  public byte[] local(){return local;}
  public MediaTransfer.Info info()throws Exception{return new MediaTransfer.Info(MediaTransfer.hash(remote),remote==null?0:remote.length,false);}
  public byte[] download(){downloads++;return corrupt?bytes("corrupt"):remote;}
  public void upload(byte[] b,String hash,String expected)throws Exception{assertEquals(MediaTransfer.hash(remote),expected);remote=b;uploads++;}
  public void save(byte[] b,String expected)throws Exception{assertEquals(MediaTransfer.hash(local),expected);if(saveFails)throw new Exception("provider failed");local=b;}
 }
 @Test public void downloadValidatesAndReopensWithoutUpload()throws Exception{Disk d=new Disk();d.remote=bytes("movie");String hash=MediaTransfer.run(d,null,5,(a,b)->{});assertArrayEquals(d.remote,d.local);assertEquals(hash,MediaTransfer.run(d,hash,5,(a,b)->{}));assertEquals(1,d.downloads);assertEquals(0,d.uploads);}
 @Test public void uploadRetryAfterLostReceiptDoesNotRepeatPut()throws Exception{Disk d=new Disk();d.local=bytes("movie");MediaTransfer.run(d,null,5,(a,b)->{});MediaTransfer.run(d,null,5,(a,b)->{});assertEquals(1,d.uploads);}
 @Test public void corruptedDownloadNeverReplacesLocal()throws Exception{Disk d=new Disk();d.remote=bytes("movie");d.corrupt=true;try{MediaTransfer.run(d,null,5,(a,b)->{});fail();}catch(Exception expected){assertNull(d.local);}}
 @Test public void failedProviderNeverReturnsReceipt()throws Exception{Disk d=new Disk();d.remote=bytes("movie");d.saveFails=true;try{MediaTransfer.run(d,null,5,(a,b)->{});fail();}catch(Exception expected){assertNull(d.local);}}
 @Test public void equalSizeDivergenceRetainsBoth()throws Exception{Disk d=new Disk();d.local=bytes("local");d.remote=bytes("other");try{MediaTransfer.run(d,MediaTransfer.hash(bytes("older")),5,(a,b)->{});fail();}catch(Exception expected){assertEquals(0,d.downloads);assertEquals(0,d.uploads);}}
}
