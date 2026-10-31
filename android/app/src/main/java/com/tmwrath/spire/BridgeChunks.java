package com.tmwrath.spire;
import org.json.JSONObject;
import java.util.HashMap;
/** Per-WebView bounded request reassembly. No partial request reaches storage. */
final class BridgeChunks {
 private static final int PART=128*1024,LIMIT=64*1024*1024;
 private static final class Task{String[] parts;int received,bytes;long started=System.nanoTime();Task(int total){parts=new String[total];}}
 private final HashMap<Long,Task> pending=new HashMap<>();
 synchronized JSONObject accept(JSONObject message)throws Exception{
  if(!"request-part".equals(message.optString("operation")))return message;
  pending.entrySet().removeIf(e->System.nanoTime()-e.getValue().started>60_000_000_000L);
  long id=message.getLong("id");int total=message.getInt("total"),index=message.getInt("index");String part=message.getString("part");
  if(total<1||total>1024||index<0||index>=total||part.length()>PART){pending.remove(id);throw new Exception("Invalid bridge chunk");}
  Task task=pending.get(id);if(task==null){if(pending.size()>=8)throw new Exception("Too many bridge requests");task=new Task(total);pending.put(id,task);}
  if(task.parts.length!=total||(task.parts[index]!=null&&!task.parts[index].equals(part))){pending.remove(id);throw new Exception("Inconsistent bridge chunk");}
  if(task.parts[index]==null){task.bytes+=part.length();if(task.bytes>LIMIT){pending.remove(id);throw new Exception("Bridge request exceeds limit");}task.parts[index]=part;task.received++;}
  if(task.received<total)return null;
  pending.remove(id);JSONObject request=new JSONObject(String.join("",task.parts));if(request.getLong("id")!=id||"request-part".equals(request.optString("operation")))throw new Exception("Bridge request identity changed");return request;
 }
}
