package com.tmwrath.spire;
/** Small allowlist shared by the origin-scoped native settings handler. */
final class AppActions {
 static boolean allowed(String action) {
  return "folder-confirmed".equals(action)||"reload-confirmed".equals(action)||"connection-confirmed".equals(action)||"leave".equals(action)||"info".equals(action)||"reload".equals(action)||"print".equals(action)||"connection".equals(action)||"about".equals(action);
 }
 static boolean trusted(String server,String origin,boolean mainFrame) {
  return mainFrame && ServerAddress.sameOrigin(server,origin);
 }
}
