package com.tmwrath.spire;
/** Three-way binary reconciliation. Missing bytes are never a successful receipt. */
final class MediaReconciler {
 static String direction(String local,String remote,String base){
  if(local.equals(remote))return local.equals("missing")?"unavailable":"ready";
  if(local.equals("missing")||local.equals(base))return remote.equals("missing")?"unavailable":"download";
  if(remote.equals("missing")||remote.equals(base))return "upload";
  return "conflict";
 }
}
