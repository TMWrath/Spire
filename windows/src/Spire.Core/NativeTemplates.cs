using YamlDotNet.RepresentationModel;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace Spire.Core;
public sealed record NativeTemplate(string Id,string Title,string Category,string Content,string Description="");
public static class NativeTemplates
{
 // Exact text from read-only shared/full-templates.ts. Load locally, even without a snapshot.
 static readonly IReadOnlyList<NativeTemplate> full=LoadFull();
 static IReadOnlyList<NativeTemplate> LoadFull()
 {
  using var stream=typeof(NativeTemplates).Assembly.GetManifestResourceStream("Spire.Core.Resources.full-templates.json")??throw new InvalidDataException("Missing built-in template resource.");
  using var doc=JsonDocument.Parse(stream);return doc.RootElement.EnumerateArray().Select(t=>new NativeTemplate(t.GetProperty("id").GetString()!,t.GetProperty("title").GetString()!,"full",t.GetProperty("content").GetString()!,t.GetProperty("description").GetString()!)).ToArray();
 }
 public static IReadOnlyList<NativeTemplate> For(string content,string path)=>new NativeTemplate[]{new("header-hero","Header & hero","section",Hero(content,path)),new("collapsible","Collapsible section","section","<details>\n<summary>Section title</summary>\n\nSection content\n\n</details>")}.Concat(full).ToArray();
 public static IReadOnlyList<string> FullIds {get;}=full.Select(t=>t.Id).ToArray();
 // Quick action parity: hosted pickers offer the built-in full templates; section templates are excluded.
 public static IReadOnlyList<NativeTemplate> Full=>full;
 static string Hero(string content,string path)
 {
  LocalFiles.ValidatePath(path);var properties=PortableMetadata.Read(content).Properties;
  string Text(string key)=>properties.TryGetValue(key,out var value)&&value is YamlScalarNode s&&PortableMetadata.IsString(s)?s.Value??"":"";
  var tags=properties.GetValueOrDefault("tags") switch{YamlScalarNode tag when PortableMetadata.IsString(tag)=>new[]{tag.Value??""},YamlSequenceNode items=>items.Children.OfType<YamlScalarNode>().Where(PortableMetadata.IsString).Select(s=>s.Value??"").ToArray(),_=>[]};
  var hero=Text("hero");if(!Regex.IsMatch(hero,@"^Attachments/heroes/[\w.-]+\.(?:png|jpe?g|webp|gif)$",RegexOptions.IgnoreCase))hero="";
  var image=hero.Length>0?"![Header image]("+string.Concat(Enumerable.Repeat("../",path.Split('/').Length-1))+hero+")":"*[Add a header image in the note sidebar]*";
  var description=Text("description").Trim();description=description.Length>0?string.Join("\n",Regex.Split(description,"\r?\n").Select(line=>"> "+line)):"> Add a description in the note sidebar";
  return "<!-- spire:hero-section:start -->\n"+image+"\n\n"+description+"\n\n"+(tags.Length>0?string.Join(" ",tags.Select(t=>"#"+t)):"*Add tags in the note sidebar*")+"\n<!-- spire:hero-section:end -->";
 }
 public static SourceEdit Insert(string content,int offset,string template)
 {
  var front=Regex.Match(content,@"\A---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)");var at=Math.Max(front.Success?front.Length:0,Math.Clamp(offset,0,content.Length));
  var prefix=content[..at];var suffix=content[at..];var inserted=(prefix.Length>0&&!prefix.EndsWith("\n\n",StringComparison.Ordinal)?"\n\n":"")+template+(suffix.Length>0&&!template.EndsWith("\n\n",StringComparison.Ordinal)?"\n":"");
  return new(prefix+inserted+suffix,at,inserted.Length);
 }
}
