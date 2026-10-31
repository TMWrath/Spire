package com.tmwrath.spire;

import java.io.*;

/** Single byte-range support for WebView's seekable media requests. */
final class MediaRange {
 final long start,end,total;
 final boolean partial;
 private MediaRange(long start,long end,long total,boolean partial){this.start=start;this.end=end;this.total=total;this.partial=partial;}
 long length(){return Math.max(0,end-start+1);}
 static MediaRange parse(String header,long size){
  if(size<0)throw new IllegalArgumentException("Unknown media length");
  if(header==null||header.isBlank())return new MediaRange(0,size-1,size,false);
  if(!header.startsWith("bytes=")||header.indexOf(',')>=0)throw new IllegalArgumentException("Unsupported range");
  String[] parts=header.substring(6).trim().split("-",-1);
  if(parts.length!=2||size==0)throw new IllegalArgumentException("Unsatisfiable range");
  try{
   long start,end;
   if(parts[0].isEmpty()){long suffix=Long.parseLong(parts[1]);if(suffix<=0)throw new IllegalArgumentException();start=Math.max(0,size-suffix);end=size-1;}
   else{start=Long.parseLong(parts[0]);end=parts[1].isEmpty()?size-1:Math.min(Long.parseLong(parts[1]),size-1);}
   if(start<0||start>=size||end<start)throw new IllegalArgumentException();
   return new MediaRange(start,end,size,true);
  }catch(NumberFormatException e){throw new IllegalArgumentException("Invalid range",e);}
 }
 InputStream stream(InputStream source)throws IOException{
  if(source==null)throw new FileNotFoundException("Media stream unavailable");
  try{long skip=start;while(skip>0){long n=source.skip(skip);if(n>0){skip-=n;continue;}if(source.read()<0)throw new EOFException("Media shorter than advertised");skip--;}}
  catch(IOException e){source.close();throw e;}
  return new FilterInputStream(source){
   long remaining=length();
   @Override public int read()throws IOException{if(remaining==0)return -1;int v=in.read();if(v<0)throw new EOFException("Incomplete media stream");remaining--;return v;}
   @Override public int read(byte[] b,int off,int len)throws IOException{if(len==0)return 0;if(remaining==0)return -1;int n=in.read(b,off,(int)Math.min(len,remaining));if(n<0)throw new EOFException("Incomplete media stream");remaining-=n;return n;}
   @Override public long skip(long n)throws IOException{long skipped=in.skip(Math.min(Math.max(0,n),remaining));remaining-=skipped;return skipped;}
   @Override public int available()throws IOException{return (int)Math.min(in.available(),remaining);}
  };
 }
}
