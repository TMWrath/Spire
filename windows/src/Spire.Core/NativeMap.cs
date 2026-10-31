using System.Text.RegularExpressions;
namespace Spire.Core;
public sealed record MapEdge(Guid Source,Guid Target);
public sealed record NativeMapGraph(IReadOnlyList<ServerFile> Nodes,IReadOnlyList<MapEdge> Edges)
{
 public static NativeMapGraph Build(IEnumerable<ServerFile> files)
 {
  var active=files.Where(f=>!f.Deleted).OrderBy(f=>f.Path,StringComparer.OrdinalIgnoreCase).ToArray();
  var edges=new HashSet<MapEdge>();
  foreach(var file in active)
  {
   var masked=Regex.Replace(file.Content,@"```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`",m=>new string(' ',m.Length));
   foreach(Match m in Regex.Matches(masked,@"\[\[([^\]\n]+)\]\]|\[([^\]\n]*)\]\(([^)\s]+)\)"))
   {
    var target=m.Groups[1].Success?m.Groups[1].Value.Split('|')[0]:m.Groups[3].Value;
    if(Regex.IsMatch(target,@"^[a-z]+:",RegexOptions.IgnoreCase)||target.StartsWith("//"))continue;
    try{target=Uri.UnescapeDataString(target);}catch(UriFormatException){}
    target=target.Split('#')[0];if(target.Length==0)continue;
    var parent=file.Path.Split('/').SkipLast(1).ToList();
    foreach(var segment in target.Split('/')){if(segment==".."){if(parent.Count>0)parent.RemoveAt(parent.Count-1);}else if(segment!=".")parent.Add(segment);}
    var relative=string.Join('/',parent);
    static string Stem(string s)=>Regex.Replace(s,@"\.md$","",RegexOptions.IgnoreCase);
    static bool Same(string a,string b)=>string.Equals(Stem(a),Stem(b),StringComparison.OrdinalIgnoreCase);
    var resolved=active.FirstOrDefault(f=>Same(f.Path,relative))??active.FirstOrDefault(f=>Same(f.Path,target));
    if(resolved is null){var matches=active.Where(f=>Same(f.Path.Split('/')[^1],target)||PortableMetadata.Read(f.Content).Aliases.Any(a=>string.Equals(a,target,StringComparison.OrdinalIgnoreCase))).ToArray();if(matches.Length==1)resolved=matches[0];}
    if(resolved is not null&&resolved.Id!=file.Id)edges.Add(new(resolved.Id,file.Id));
   }
  }
  return new(active,edges.OrderBy(e=>e.Source).ThenBy(e=>e.Target).ToArray());
 }
}
public readonly record struct MapPoint3(double X,double Y,double Z);
public readonly record struct MapPoint2(double X,double Y,double Depth,double Scale);
public static class NativeMapProjection
{
 public static IReadOnlyList<MapPoint3> Sphere(int count)
 {
  if(count<0)throw new ArgumentOutOfRangeException(nameof(count));
  var points=new List<MapPoint3>();
  for(int i=0;i<count;i++){var y=1-2*(i+0.5)/count;var r=Math.Sqrt(1-y*y);var angle=i*Math.PI*(3-Math.Sqrt(5));points.Add(new(Math.Cos(angle)*r,y,Math.Sin(angle)*r));}
  return points;
 }
 public static MapPoint2 Project(MapPoint3 p,double yaw,double pitch,double zoom,double width,double height)
 {
  var x=p.X*Math.Cos(yaw)+p.Z*Math.Sin(yaw);var z=-p.X*Math.Sin(yaw)+p.Z*Math.Cos(yaw);
  var y=p.Y*Math.Cos(pitch)-z*Math.Sin(pitch);z=p.Y*Math.Sin(pitch)+z*Math.Cos(pitch);
  var scale=3/(3-z);var radius=Math.Min(width,height)*0.36*Math.Clamp(zoom,0.25,4);
  return new(width/2+x*radius*scale,height/2+y*radius*scale,z,scale);
 }
 public static MapPoint3 Pulse(MapPoint3 source,MapPoint3 target,double progress)
 {var t=Math.Clamp(progress,0,1);return new(source.X+(target.X-source.X)*t,source.Y+(target.Y-source.Y)*t,source.Z+(target.Z-source.Z)*t);}
}
