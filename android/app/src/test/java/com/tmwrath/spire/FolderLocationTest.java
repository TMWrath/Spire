package com.tmwrath.spire;
import android.net.Uri;
import android.os.Environment;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class FolderLocationTest {
 @Test public void internalDirectory(){assertEquals(Environment.getExternalStorageDirectory().getAbsolutePath()+"/Documents/Spire Local",LocalFolder.displayDirectory(Uri.parse("content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FSpire%20Local"),"Spire Local"));}
 @Test public void removableDirectory(){assertEquals("/storage/ABCD-1234/Writing",LocalFolder.displayDirectory(Uri.parse("content://com.android.externalstorage.documents/tree/ABCD-1234%3AWriting"),"Writing"));}
 @Test public void providerDoesNotInventFilesystemPath(){assertEquals("Writing (example.documents: cloud-folder)",LocalFolder.displayDirectory(Uri.parse("content://example.documents/tree/cloud-folder"),"Writing"));}
}
