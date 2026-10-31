using System.Text.Json;
using System.Text.Json.Nodes;
namespace Spire.Core;
public sealed partial record SyncWorkspace
{
 internal SyncWorkspace RebindSource(string provisional,string canonical)
 {
  string Rebind(string content)
  {
   foreach(var citation in PortableCitations.Read(content).Where(c=>c.SourceId.ToString()==provisional).Reverse())
   {
    var original=content[citation.Start..(citation.Start+citation.Length)];
    var updated=original.Replace("Sources/"+provisional+".md","Sources/"+canonical+".md",StringComparison.OrdinalIgnoreCase);
    content=content[..citation.Start]+updated+content[(citation.Start+citation.Length)..];
   }
   return content;
  }
  var pending=Outbox.Select(m=>m with{Content=Rebind(m.Content)}).ToList();
  // A local citation can already be a retained file conflict: never discard that draft.
  var conflicts=Conflicts.Select(c=>
  {
   var root=JsonNode.Parse(c.GetRawText())!.AsObject();var mutation=root["mutation"]!.AsObject();mutation["content"]=Rebind(mutation["content"]!.GetValue<string>());return JsonSerializer.SerializeToElement(root,Json);
  }).ToArray();
  foreach(var f in VisibleFiles().Where(f=>pending.All(m=>m.Id!=f.Id)&&conflicts.All(c=>c.GetProperty("mutation").GetProperty("id").GetGuid()!=f.Id)))
  {
   var content=Rebind(f.Content);if(content!=f.Content)pending.Add(new(Guid.NewGuid(),f.Id,f.Rev,f.Path,content,f.Deleted,f.TemplateIds));
  }
  return this with{Outbox=pending,Conflicts=conflicts};
 }
}
