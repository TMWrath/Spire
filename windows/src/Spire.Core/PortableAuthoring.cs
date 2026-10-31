using System.Text.RegularExpressions;
namespace Spire.Core;
public sealed record SourceRange(string Content,int Start,int Length);
public sealed record SourceEdit(string Content,int Start,int Length);
public static class PortableAuthoring
{
 public static SourceEdit Replace(SourceRange r,string value)
 {
  if(r.Start<0||r.Length<0||r.Start+r.Length>r.Content.Length)throw new ArgumentOutOfRangeException(nameof(r));
  return new(r.Content[..r.Start]+value+r.Content[(r.Start+r.Length)..],r.Start,value.Length);
 }
 public static SourceEdit Wrap(SourceRange r,string before,string after)
 {
  var edited=Replace(r,before+r.Content.Substring(r.Start,r.Length)+after);
  return edited with{Start=r.Start+before.Length,Length=r.Length};
 }
 public static SourceEdit Heading(SourceRange r,int level)
 {
  if(level<0||level>6)throw new ArgumentOutOfRangeException(nameof(level));
  int start=r.Start==0?0:r.Content.LastIndexOf('\n',r.Start-1)+1;
  int end=r.Content.IndexOf('\n',r.Start);if(end<0)end=r.Content.Length;
  string line=Regex.Replace(r.Content[start..end],@"^#{1,6}\s+","");
  return Replace(new(r.Content,start,end-start),(level==0?"":new string('#',level)+" ")+line);
 }
 public static string Block(string kind,string text,string language="")
 {
  text=text.Replace("\r\n","\n").Replace('\r','\n');
  if(kind=="quote")return string.Join('\n',text.Split('\n').Select(l=>l.Length==0?">":"> "+l));
  if(kind!="code")throw new ArgumentException("Unknown block.");
  var fence=new string('`',Math.Max(3,Regex.Matches(text,"`+").Select(m=>m.Length+1).DefaultIfEmpty(3).Max()));
  return fence+Regex.Replace(language,@"[^a-zA-Z0-9_+#.-]","")+"\n"+text+"\n"+fence;
 }
 public static string Table(string id,string[][] cells,string[] alignments)
 {
  if(!Regex.IsMatch(id,@"^[a-zA-Z0-9_-]+$"))throw new ArgumentException("Invalid table identity.");
  int columns=Math.Max(1,cells.Select(r=>r.Length).DefaultIfEmpty(1).Max());
  string Escape(string c)=>Regex.Replace(c,@"(\\*)\|",m=>m.Groups[1].Value+(m.Groups[1].Length%2==0?"\\":"")+"|").Replace("\r\n","\n").Replace("\n","<br>");
  string Row(string[] row)=>"| "+string.Join(" | ",Enumerable.Range(0,columns).Select(i=>Escape(i<row.Length?row[i]:"")))+" |";
  var rows=cells.Length==0?new[]{Array.Empty<string>()}:cells;
  var separators=Enumerable.Range(0,columns).Select(i=>(i<alignments.Length?alignments[i]:"") switch{"left"=>":---","center"=>":---:","right"=>"---:",_=>"---"}).ToArray();
  return "<!-- spire:table id="+id+" -->\n"+Row(rows[0])+"\n"+Row(separators)+"\n"+string.Join('\n',rows.Skip(1).Select(Row))+"\n<!-- /spire:table -->";
 }
 public static string Dictionary(string title)
 {
  var clean=Regex.Replace(title.Trim(),@"[\r\n]+"," ");if(clean.Length==0)throw new ArgumentException("Enter a dictionary page name.");
  return "---\nspire_type: dictionary\n---\n\n# "+clean+"\n";
 }
 public static string HeadingId(string text)=>Regex.Replace(Regex.Replace(text.ToLowerInvariant(),@"[^\p{L}\p{N} -]",""),@"\s+","-");
 public static string AppendDefinition(string content,string term,string definition)
 {
  term=term.Trim();definition=definition.Trim();
  if(term.Length==0||term.Contains('\n')||term.Contains('\r')||definition.Length==0)throw new ArgumentException("Enter a single-line term and a definition.");
  // Ignore fenced code; entry headings are canonical portable Markdown.
  bool fenced=false;
  foreach(var line in content.Split('\n'))
  {
   if(Regex.IsMatch(line,@"^\s*(`{3,}|~{3,})")){fenced=!fenced;continue;}
   var m=Regex.Match(line,@"^##\s+(.+?)\s*#*\s*$");
   if(!fenced&&m.Success&&HeadingId(m.Groups[1].Value)==HeadingId(term))throw new ArgumentException("That term already exists in this dictionary.");
  }
  return content.TrimEnd()+"\n\n## "+term+"\n"+definition+"\n";
 }
}
