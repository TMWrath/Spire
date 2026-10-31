using Spire.Core;
using System.Text.Json;
static class MapTests
{
 static void Check(bool v,string m){if(!v)throw new Exception(m);}
 static ServerFile F(string path,string content,bool deleted=false)=>new(Guid.NewGuid(),1,path,content,deleted,"",JsonSerializer.SerializeToElement(Array.Empty<object>()));
 public static void Run()
 {
  var a=F("Writing/A.md","[B](../Library/B.md) [[B]] `[[Hidden]]`\n```\n[[Hidden]]\n```" );var b=F("Library/B.md","");var hidden=F("Library/Hidden.md","");var gone=F("Library/Gone.md","",true);
  var graph=NativeMapGraph.Build(new[]{a,b,hidden,gone});
  Check(graph.Nodes.Count==3&&graph.Edges.Count==1,"Map must deduplicate file links, mask code and exclude trash");
  Check(graph.Edges[0].Source==b.Id&&graph.Edges[0].Target==a.Id,"Pulses must travel source file to referencing file");
  var ambiguous=F("Other/B.md","");graph=NativeMapGraph.Build(new[]{a,b,ambiguous});
  Check(graph.Edges.Count==1,"Relative exact link must survive ambiguous basename");
  var points=NativeMapProjection.Sphere(50);
  Check(points.Count==50&&points.All(p=>Math.Abs(p.X*p.X+p.Y*p.Y+p.Z*p.Z-1)<1e-9),"Native sphere points are not unit radius");
  Check(points.Distinct().Count()==50,"Sphere has duplicate positions");
  var front=NativeMapProjection.Project(new(0,0,1),0,0,1,800,600);var back=NativeMapProjection.Project(new(0,0,-1),0,0,1,800,600);
  Check(front.X==400&&front.Y==300&&front.Scale>back.Scale,"Projection must use depth and viewport center");
  var rotated=NativeMapProjection.Project(new(1,0,0),Math.PI/2,0,1,800,600);
  Check(Math.Abs(rotated.X-400)<1e-9,"Yaw does not rotate around sphere");
  var mid=NativeMapProjection.Pulse(new(0,0,0),new(10,20,30),0.5);
  Check(mid==new MapPoint3(5,10,15),"Pulse does not follow edge");
  Console.WriteLine("PASS: native map direction, relative links, code masking, ambiguity/trash exclusion, sphere uniqueness, depth/yaw projection, pulse interpolation");
 }
}
