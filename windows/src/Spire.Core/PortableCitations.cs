using System.Text.Json;
using System.Text.RegularExpressions;
namespace Spire.Core;
public sealed record SourceCitation(Guid SourceId,string Label,int Start,int Length,string Identity);
public static class PortableCitations
{
 public static IReadOnlyList<SourceCitation> Read(string content)
 {
  var masked=Regex.Replace(content,@"```[\s\S]*?```|~~~[\s\S]*?~~~|(?<!\\)`[^`]*(?<!\\)`|<!--[\s\S]*?-->",m=>new string(' ',m.Length));
  return Regex.Matches(masked,@"(?<!!)\[((?:\\.|[^\]\\])*)\]\(((?:\.\./|\./)*Sources/([a-f0-9-]{36})\.md)\)",RegexOptions.IgnoreCase).Where(m=>Guid.TryParse(m.Groups[3].Value,out _)).Select(m=>new SourceCitation(Guid.Parse(m.Groups[3].Value),m.Groups[1].Value,m.Index,m.Length,m.Groups[3].Value)).ToArray();
 }
 public static string Rebase(string content,string newPath)
 {
  LocalFiles.ValidatePath(newPath);var relative=string.Concat(Enumerable.Repeat("../",newPath.Split('/').Length-1))+"Sources/";
  var result=content;foreach(var c in Read(content).Reverse())
  {
   var raw=content.Substring(c.Start,c.Length);var rewritten=Regex.Replace(raw,@"\]\([^)]*\)$",m=>"]("+relative+c.Identity+".md)");
   result=result.Remove(c.Start,c.Length).Insert(c.Start,rewritten);
  }
  return result;
 }
 public static string Insert(JsonElement source,string filePath,string locator,string quote)
 {
  LocalFiles.ValidatePath(filePath);
  if(locator.Length>300||quote.Length>10000)throw new ArgumentException("Citation exceeds supported size.");
  var id=source.GetProperty("id").GetGuid();
  string Field(string key)=>source.TryGetProperty(key,out var value)?value.GetString()??"":"";
  string Escape(string value)=>Regex.Replace(value.Replace("\\","\\\\"),@"[\[\]*_`<>]",m=>"\\"+m.Value).Replace("\r\n"," ").Replace("\n"," ");
  var label=string.Join(", ",new[]{Field("author"),Field("title"),Field("year"),locator.Trim()}.Where(s=>s.Length>0).Select(Escape));
  var relative=string.Concat(Enumerable.Repeat("../",filePath.Split('/').Length-1))+"Sources/"+id+".md";
  var citation="["+label+"]("+relative+")";
  return string.IsNullOrWhiteSpace(quote)?citation:"\n\n"+string.Join('\n',quote.Trim().Replace("\r\n","\n").Split('\n').Select(line=>"> "+line))+"\n>\n> — "+citation+"\n\n";
 }
}
