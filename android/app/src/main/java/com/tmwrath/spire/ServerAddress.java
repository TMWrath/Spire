package com.tmwrath.spire;

import java.net.URI;
import java.util.Locale;

/** Deliberately supports HTTPS root deployments only, matching Spire's absolute API paths. */
public final class ServerAddress {
    private ServerAddress() {}
    public static String normalize(String input) {
        String text = input.trim();
        if (!text.contains("://")) text = "https://" + text;
        try {
            URI u = new URI(text);
            int port = u.getPort();
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getUserInfo() != null
                    || u.getRawQuery() != null || u.getRawFragment() != null
                    || !(u.getRawPath().isEmpty() || "/".equals(u.getRawPath()))
                    || port == 0 || port > 65535 || port < -1) throw new IllegalArgumentException();
            return "https://" + u.getHost().toLowerCase(Locale.ROOT) + (port == -1 || port == 443 ? "" : ":" + port);
        } catch (Exception e) {
            throw new IllegalArgumentException("Enter an HTTPS server address without a path, login, query or fragment.");
        }
    }
    public static boolean sameOrigin(String server, String target) {
        try {
            URI u = new URI(target);
            if (u.getUserInfo() != null || u.getHost() == null) return false;
            return server.equals(normalize(u.getScheme() + "://" + u.getRawAuthority()));
        } catch (Exception e) { return false; }
    }
    public static String safeFilename(String name) {
        String result = name.replace('\\', '/');
        result = result.substring(result.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        if (result.isEmpty() || result.equals(".") || result.equals("..")) return "download";
        return result.substring(0, Math.min(result.length(), 180));
    }
}
