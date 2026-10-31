package com.tmwrath.spire;

import android.util.Base64;
import android.webkit.CookieManager;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Only the bundled renderer may call this transport. No SAF/folder operations,
 * arbitrary headers, redirects, cleartext origins or native credentials escape. */
public final class RemoteTransport {
    private static final int LIMIT=32*1024*1024;
    private RemoteTransport() {}
    public static String checkedURL(JSONObject request) throws Exception {
        String origin=ServerAddress.normalize(request.getString("origin"));
        if(!request.getString("origin").startsWith("https://"))throw new Exception("HTTPS required");
        String path=request.getString("path");URI parsed=new URI(origin+path);
        if(!path.startsWith("/api/")||path.contains("\\")||path.length()>20000||parsed.getRawFragment()!=null||!parsed.normalize().getRawPath().equals(parsed.getRawPath())||!ServerAddress.sameOrigin(origin,parsed.toString()))throw new Exception("Invalid API path");
        String method=request.getString("method");if(!java.util.Arrays.asList("GET","HEAD","POST","PUT","DELETE").contains(method))throw new Exception("Method rejected");
        JSONObject headers=request.optJSONObject("headers");if(headers!=null){Iterator<String> keys=headers.keys();while(keys.hasNext()){String key=keys.next(),value=headers.getString(key);String lower=key.toLowerCase(Locale.ROOT);if(!lower.equals("content-type")&&!lower.equals("x-csrf-token")||value.length()>4096||value.contains("\r")||value.contains("\n"))throw new Exception("Header rejected");}}
        String body=request.optString("body","");if(body.length()>48*1024*1024||(!body.isEmpty()&&(method.equals("GET")||method.equals("HEAD"))))throw new Exception("Request body rejected");
        return origin+path;
    }
    public static JSONObject request(android.content.Context context,JSONObject request) throws Exception {
        String target=checkedURL(request),origin=ServerAddress.normalize(request.getString("origin"));
        HttpURLConnection c=(HttpURLConnection)new URL(target).openConnection();
        c.setConnectTimeout(12000);c.setReadTimeout(25000);c.setInstanceFollowRedirects(false);c.setRequestMethod(request.getString("method"));
        try{
            c.setRequestProperty("Origin",origin);CookieManager cookies=CookieManager.getInstance();String cookie=DeviceState.session(context,origin);if(cookie!=null)c.setRequestProperty("Cookie",cookie);
            JSONObject headers=request.optJSONObject("headers");if(headers!=null){Iterator<String> keys=headers.keys();while(keys.hasNext()){String key=keys.next();c.setRequestProperty(key,headers.getString(key));}}
            if(request.has("body")&&!request.isNull("body")){byte[] bytes=request.optBoolean("binary")?Base64.decode(request.getString("body"),Base64.DEFAULT):request.getString("body").getBytes(StandardCharsets.UTF_8);c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);try(java.io.OutputStream out=c.getOutputStream()){out.write(bytes);}}
            int status=c.getResponseCode();if(status>=300&&status<400)throw new Exception("Redirect blocked");
            for(Map.Entry<String,List<String>> h:c.getHeaderFields().entrySet())if(h.getKey()!=null&&h.getKey().equalsIgnoreCase("Set-Cookie"))for(String value:h.getValue()){DeviceState.acceptSession(context,origin,value);cookies.setCookie(origin,value);}cookies.flush();
            InputStream stream=status>=400?c.getErrorStream():c.getInputStream();ByteArrayOutputStream data=new ByteArrayOutputStream();if(stream!=null)try(InputStream in=stream){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1){if(data.size()+n>LIMIT)throw new Exception("Response exceeds 32 MiB");data.write(bytes,0,n);}}
            return new JSONObject().put("status",status).put("type",c.getContentType()==null?"application/octet-stream":c.getContentType()).put("body",Base64.encodeToString(data.toByteArray(),Base64.NO_WRAP));
        }finally{c.disconnect();}
    }
}
