package com.tmwrath.spire;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaReconcilerTest {
 @Test public void serverOnlyDownloads(){assertEquals("download",MediaReconciler.direction("missing","b","a"));}
 @Test public void localOnlyUploads(){assertEquals("upload",MediaReconciler.direction("b","missing","a"));}
 @Test public void serverChangeDownloads(){assertEquals("download",MediaReconciler.direction("a","b","a"));}
 @Test public void localChangeUploads(){assertEquals("upload",MediaReconciler.direction("b","a","a"));}
 @Test public void sameBytesSkip(){assertEquals("ready",MediaReconciler.direction("a","a",null));}
 @Test public void divergenceKeepsBoth(){assertEquals("conflict",MediaReconciler.direction("b","c","a"));}
 @Test public void bothMissingIsFailure(){assertEquals("unavailable",MediaReconciler.direction("missing","missing",null));}
}
