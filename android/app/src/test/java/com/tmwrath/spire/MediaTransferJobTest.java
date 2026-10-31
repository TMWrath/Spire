package com.tmwrath.spire;
import android.app.job.*;
import android.content.Context;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
public class MediaTransferJobTest {
 @Test public void schedulesPersistentNetworkConstrainedJob(){Context c=RuntimeEnvironment.getApplication();MediaTransferJob.schedule(c);JobInfo job=((JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE)).getPendingJob(MediaTransferJob.JOB_ID);assertNotNull(job);assertTrue(job.isPersisted());assertEquals(JobInfo.NETWORK_TYPE_ANY,job.getNetworkType());assertEquals(MediaTransferJob.class.getName(),job.getService().getClassName());}
 @Test public void systemStopRequestsRescheduling(){assertTrue(new MediaTransferJob().onStopJob(null));}
}
