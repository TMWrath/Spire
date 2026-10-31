package com.tmwrath.spire;
import org.junit.Test;
import static org.junit.Assert.*;
public class ServerAddressTest {
 @Test public void canonicalHttpsOrigin() { assertEquals("https://spire.example", ServerAddress.normalize(" spire.example/ ")); }
 @Test public void preservesPort() { assertEquals("https://host.test:8443", ServerAddress.normalize("https://HOST.test:8443/")); }
 @Test public void acceptsBareHostWithPort() { assertEquals("https://host.test:8443", ServerAddress.normalize("host.test:8443")); }
 @Test public void stripsDefaultPort() { assertEquals("https://host.test", ServerAddress.normalize("https://host.test:443")); }
 @Test public void acceptsPrivateHttps() { assertEquals("https://192.168.1.88", ServerAddress.normalize("https://192.168.1.88")); }
 @Test public void rejectsUnsafeOrAmbiguousInput() { for(String s:new String[]{"http://host.test", "javascript:alert(1)", "https://user:pass@host.test", "https://host.test/sub", "https://host.test?q=x", "https://host.test#x", "", "https://host.test:0", "https://host.test:65536", "https://host.test/../", "https://"}) { try { ServerAddress.normalize(s); fail(s); } catch(IllegalArgumentException expected) {} } }
 @Test public void originMatchingIsExact() { assertTrue(ServerAddress.sameOrigin("https://host.test", "https://host.test/a?q=x")); assertTrue(ServerAddress.sameOrigin("https://host.test", "https://host.test:443/a")); for(String s:new String[]{"https://host.test.evil/a", "http://host.test/a", "https://host.test:444/a", "https://user@host.test/a", "file:///tmp/a", "blob:https://host.test/x"}) assertFalse(s, ServerAddress.sameOrigin("https://host.test",s)); }
 @Test public void filenamesAreSafe() { assertEquals("backup.json", ServerAddress.safeFilename("../../backup.json")); assertEquals("download", ServerAddress.safeFilename("")); assertEquals("ab.txt", ServerAddress.safeFilename("a\nb.txt")); }
}
