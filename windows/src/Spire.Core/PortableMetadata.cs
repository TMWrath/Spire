using System.Text.RegularExpressions;
using YamlDotNet.RepresentationModel;
namespace Spire.Core;

public sealed record MarkdownMetadata(IReadOnlyDictionary<string,YamlNode> Properties,string[] Aliases,string[] Tags,string Body,string? Error);
public static class PortableMetadata
{
 static readonly Regex Front=new(@"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)");
 public static MarkdownMetadata Read(string content)
 {
  var match=Front.Match(content);var properties=new Dictionary<string,YamlNode>(StringComparer.Ordinal);string? error=null;
  if(match.Success)
  {
   try
   {
    var yaml=new YamlStream();yaml.Load(new StringReader(match.Groups[1].Value));
    if(yaml.Documents.Count!=1||yaml.Documents[0].RootNode is not YamlMappingNode map)error="Frontmatter must be a mapping";
    else foreach(var pair in map.Children)if(pair.Key is YamlScalarNode key&&key.Value is string name)properties[name]=pair.Value;
   }
   catch(YamlDotNet.Core.YamlException){error="Invalid YAML; source preserved";}
  }
  static string[] List(YamlNode? node)=>node switch
  {
   YamlScalarNode s when IsString(s)=>[s.Value??""],
   YamlSequenceNode seq=>seq.Children.OfType<YamlScalarNode>().Where(IsString).Select(s=>s.Value??"").ToArray(),
   _=>[]
  };
  var tags=List(properties.GetValueOrDefault("tags")).Concat(Regex.Matches(content,@"(?:^|\s)#([\p{L}\p{N}_/-]+)").Select(m=>m.Groups[1].Value)).Distinct(StringComparer.Ordinal).ToArray();
  return new(properties,List(properties.GetValueOrDefault("aliases")),tags,match.Success?content[match.Length..]:content,error);
 }
 internal static bool IsString(YamlScalarNode s)
 {
  if(s.Style is YamlDotNet.Core.ScalarStyle.SingleQuoted or YamlDotNet.Core.ScalarStyle.DoubleQuoted or YamlDotNet.Core.ScalarStyle.Literal or YamlDotNet.Core.ScalarStyle.Folded)return true;
  var value=s.Value??"";
  return value.Length>0&&!Regex.IsMatch(value,@"^(?:null|~|true|false|[-+]?(?:\d[\d_]*(?:\.\d*)?(?:e[-+]?\d+)?|\.inf|\.nan)|0x[\da-f]+|0o[0-7]+)$",RegexOptions.IgnoreCase);
 }
 public static bool Reserved(string key)=>key.StartsWith("spire_",StringComparison.Ordinal)||key is "__proto__" or "constructor" or "prototype";
 public static string ChangeProperty(string content,string? oldKey,string? key,object? value)
 {
  if(oldKey is not null&&Reserved(oldKey))throw new ArgumentException("Internal settings are managed in their own Context tabs.");
  if(key is not null&&(key!=key.Trim()||key.Length is <1 or >100||key.Any(c=>c<32)||Reserved(key)))throw new ArgumentException("Use a property name of 1–100 characters without control characters or reserved names.");
  var match=Front.Match(content);
  if(content.StartsWith("---\n",StringComparison.Ordinal)||content.StartsWith("---\r\n",StringComparison.Ordinal))
   if(!match.Success)throw new InvalidDataException("Close the YAML frontmatter in Source before editing properties.");
  var yamlText=match.Success?match.Groups[1].Value:"";var parsed=Read(content);
  if(parsed.Error is not null)throw new InvalidDataException("Fix invalid YAML frontmatter in Source before editing properties.");
  if(oldKey is not null&&!parsed.Properties.ContainsKey(oldKey))throw new InvalidOperationException("That property changed. Reopen its editor.");
  if(key is not null&&key!=oldKey&&parsed.Properties.ContainsKey(key))throw new InvalidOperationException("That property already exists.");
  var newline=content.Contains("\r\n")?"\r\n":"\n";
  bool flowHandled=false;
  if(oldKey is not null||yamlText.TrimStart().StartsWith('{'))
  {
   var yaml=new YamlStream();yaml.Load(new StringReader(yamlText));var map=(YamlMappingNode)yaml.Documents[0].RootNode;
   var pairs=map.Children.ToArray();int index=Array.FindIndex(pairs,p=>p.Key is YamlScalarNode scalar&&scalar.Value==oldKey);
   int start=index>=0?checked((int)pairs[index].Key.Start.Index):0;
   // Flow mappings cannot be spliced as independent lines. Preserve their entire unknown tree instead.
   if(map.Style==YamlDotNet.Core.Events.MappingStyle.Flow)
   {
    flowHandled=true;if(index>=0)map.Children.Remove(pairs[index].Key);if(key is not null)map.Add(new YamlScalarNode(key),ValueNode(value));
    using var writer=new StringWriter();yaml.Save(writer,false);yamlText=writer.ToString().TrimEnd('\r','\n').Replace("\r\n","\n").Replace("\n",newline);
   }
   else
   {
    start=yamlText.LastIndexOf('\n',Math.Max(0,start-1))+1;
    int end=index+1<pairs.Length?checked((int)pairs[index+1].Key.Start.Index):yamlText.Length;
    if(index+1<pairs.Length)end=yamlText.LastIndexOf('\n',Math.Max(0,end-1))+1;
    yamlText=yamlText.Remove(start,end-start);
   }
  }
  if(key is not null&&!flowHandled)
  {
   var field=System.Text.Json.JsonSerializer.Serialize(key)+": "+System.Text.Json.JsonSerializer.Serialize(value);
   if(yamlText.Length>0&&!yamlText.EndsWith('\n'))yamlText+=newline;yamlText+=field;
  }
  if(string.IsNullOrWhiteSpace(yamlText))yamlText="{}";
  var body=match.Success?content[match.Length..]:content;
  var result="---"+newline+yamlText.TrimEnd('\r','\n')+newline+"---"+newline+body;
  if(Read(result).Error is not null)throw new InvalidDataException("This edit would invalidate YAML references. Edit in Source instead; nothing was changed.");
  return result;
 }
 static YamlNode ValueNode(object? value)
 {
  var yaml=new YamlStream();yaml.Load(new StringReader(System.Text.Json.JsonSerializer.Serialize(value)));return yaml.Documents[0].RootNode;
 }
 public static IReadOnlyList<NavigationNode> TagNavigation(IEnumerable<ServerFile> files,string query)
 {
  return files.Where(f=>!f.Deleted).SelectMany(f=>Read(f.Content).Tags.Select(tag=>(tag,file:f)))
   .Where(pair=>(pair.tag+"\n"+pair.file.Path+"\n"+pair.file.Content).Contains(query,StringComparison.OrdinalIgnoreCase))
   .GroupBy(pair=>pair.tag,StringComparer.Ordinal).OrderBy(g=>g.Key,StringComparer.OrdinalIgnoreCase)
   .Select(g=>new NavigationNode(g.Key,"",null,g.OrderBy(p=>p.file.Path,StringComparer.OrdinalIgnoreCase).Select(p=>new NavigationNode(p.file.Path,p.file.Path,p.file.Id,[])).ToArray())).ToArray();
 }
}
