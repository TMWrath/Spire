using Spire.Core;
using System.Text.Json;
static class MetadataTests
{
 public static void Run()
 {
  var raw="---\r\ntags: [writing, 'two words']\r\naliases:\r\n  - Other name\r\nunknown:\r\n  future: true\r\n---\r\n# Heading\nA #inline-tag";
  var meta=PortableMetadata.Read(raw);
  if(!meta.Tags.SequenceEqual(new[]{"writing","two words","inline-tag"})||meta.Aliases.Single()!="Other name"||meta.Body!="# Heading\nA #inline-tag"||meta.Error is not null)throw new Exception("YAML lists/body/inline tags not source compatible");
  if(PortableMetadata.Read("---\ntags: [broken\n---\nbody").Error is null)throw new Exception("Invalid YAML concealed");
  var a=new ServerFile(Guid.NewGuid(),1,"Writing/A.md",raw,false,"",JsonSerializer.SerializeToElement(Array.Empty<object>()));
  var b=a with{Id=Guid.NewGuid(),Path="Writing/B.md",Content="[[Other name]]"};
  var graph=NativeMapGraph.Build(new[]{a,b});if(graph.Edges.Single().Source!=a.Id)throw new Exception("Map aliases unresolved");
  var tree=PortableMetadata.TagNavigation(new[]{a,b},"");if(tree.Count!=3||tree.Single(t=>t.Label=="writing").Children.Single().FileId!=a.Id)throw new Exception("Tags navigation wrong");
  if(a.Content!=raw)throw new Exception("Metadata reading rewrote source");
  var updated=PortableMetadata.ChangeProperty(raw,null,"description","A new description");
  if(PortableMetadata.Read(updated).Properties["description"].ToString()!="A new description"||!updated.Contains("unknown:\r\n  future: true")||PortableMetadata.Read(updated).Body!=meta.Body)throw new Exception("Property update lost unknown fields/body");
  updated=PortableMetadata.ChangeProperty(updated,"description",null,null);
  if(PortableMetadata.Read(updated).Properties.ContainsKey("description"))throw new Exception("Property deletion failed");
  bool rejected=false;try{PortableMetadata.ChangeProperty("---\ntags: [broken\n---\nbody",null,"safe","x");}catch(InvalidDataException){rejected=true;}if(!rejected)throw new Exception("Invalid YAML edited");
  rejected=false;try{PortableMetadata.ChangeProperty(raw,null,"spire_page","x");}catch(ArgumentException){rejected=true;}if(!rejected)throw new Exception("Reserved property accepted");
  Console.WriteLine("PASS: YAML lists/aliases and CRLF body; invalid-YAML disclosure; tag grouping; map aliases; source preserved; property update/delete preserves unknown fields/body and rejects reserved/invalid input");
 }
}
