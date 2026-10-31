package com.tmwrath.spire;
import java.io.*;
import java.util.Arrays;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaRangeTest {
 @Test public void fullFileAndTailRemainByteExact()throws Exception{
  byte[] bytes=new byte[2_000_003];new java.util.Random(42).nextBytes(bytes);
  try(InputStream in=MediaRange.parse(null,bytes.length).stream(new ByteArrayInputStream(bytes))){assertArrayEquals(bytes,in.readAllBytes());}
  for(String h:new String[]{"bytes=0-","bytes=12345-","bytes=-8192","bytes=15-83"}){
   MediaRange r=MediaRange.parse(h,bytes.length);
   try(InputStream in=r.stream(new ByteArrayInputStream(bytes))){assertArrayEquals(Arrays.copyOfRange(bytes,(int)r.start,(int)r.end+1),in.readAllBytes());assertEquals(-1,in.read());}
  }
 }
 @Test public void skipReturningZeroStillSeeks()throws Exception{MediaRange r=MediaRange.parse("bytes=3-5",8);try(InputStream in=r.stream(new ByteArrayInputStream(new byte[]{0,1,2,3,4,5,6,7}){@Override public long skip(long n){return 0;}})){assertArrayEquals(new byte[]{3,4,5},in.readAllBytes());}}
 @Test public void boundsAndEmpty(){assertEquals(0,MediaRange.parse(null,0).length());assertEquals(9,MediaRange.parse("bytes=0-999",10).end);for(String h:new String[]{"bytes=10-","bytes=8-2","bytes=-0","bytes=0-1,3-4","bytes=oops","bytes=999999999999999999999-"}){assertThrows(h,IllegalArgumentException.class,()->MediaRange.parse(h,10));}}
 @Test public void shortUnderlyingFileIsNotReportedAsComplete()throws Exception{try(InputStream in=MediaRange.parse(null,20).stream(new ByteArrayInputStream(new byte[2]))){assertThrows(EOFException.class,()->in.readAllBytes());}}
}
