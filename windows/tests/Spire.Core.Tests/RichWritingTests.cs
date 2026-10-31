using Spire.Core;
static class RichWritingTests
{
 public static void Run()
 {
  const string source="---\r\nfuture: {nested: true}\r\n---\r\n\r\n# A **title**\r\n\r\nHello *world* and [link](../B.md).\r\n\r\n<!-- future:opaque -->\r\n\r\n| A |\r\n| --- |\r\n| B |\r\n";
  var document=RichWritingDocument.Parse(source);
  if(document.Serialize(document.Blocks.Select(b=>b.Portable).ToArray())!=source)throw new Exception("Unchanged visual document rewrote bytes");
  var paragraph=document.Blocks.Single(b=>b.Kind=="paragraph");
  if(!paragraph.Runs.Any(r=>r.Text=="world"&&r.Italic)||!paragraph.Runs.Any(r=>r.Link=="../B.md"))throw new Exception("Visual inline marks missing");
  var edits=document.Blocks.Select(b=>b.Portable).ToArray();edits[paragraph.Index]="Changed **writing**.";
  var changed=document.Serialize(edits);
  if(changed!=source.Replace("Hello *world* and [link](../B.md).","Changed **writing**."))throw new Exception("Visual edit changed unrelated frontmatter/protected blocks/line endings");
  if(!document.Blocks.Any(b=>b.Kind=="protected"&&b.Raw.Contains("future:opaque"))||!document.Blocks.Any(b=>b.Kind=="protected"&&b.Raw.Contains("| A |")))throw new Exception("Unsupported blocks not protected");
  if(RichWritingDocument.InlineMarkdown([new("a*b",Bold:true),new(" link",Link:"../x y.md")])!="**a\\*b**[ link](../x%20y.md)")throw new Exception("Inline serialization unsafe");
  var mapped=RichWritingDocument.Parse("# 🌞 _one_ and **two** with [link](../x%20y.md).\n");
  var plain=string.Concat(mapped.Blocks[0].Runs.Select(r=>r.Text));
  foreach(var word in new[]{"one","two","link"})
  {
   int offset=plain.IndexOf(word,StringComparison.Ordinal);int sourceOffset=mapped.PlainOffset(0,offset);
   if(mapped.Source.Substring(sourceOffset,word.Length)!=word||mapped.Source[sourceOffset..mapped.PlainOffset(0,offset+word.Length,true)]!=word)throw new Exception("Visual selection did not map to original Markdown: "+word);
  }
  var escaped=RichWritingDocument.Parse("a\\*b and ``a`b``.");
  if(escaped.PlainOffset(0,2)!=3||escaped.Source.Substring(escaped.PlainOffset(0,8),3)!="a`b")throw new Exception("Escape/code selection offsets changed");
  var empty=RichWritingDocument.Parse("");
  if(empty.Blocks.Count!=1||empty.Serialize(["First words 🌞"])!="First words 🌞")throw new Exception("New visual file discarded typing");
  var yamlOnly=RichWritingDocument.Parse("---\nfuture: true\n---\n");
  if(yamlOnly.Blocks.Count!=1||yamlOnly.Serialize(["First words"])!="---\nfuture: true\n---\nFirst words")throw new Exception("YAML-only visual file discarded typing or metadata");
  Console.WriteLine("PASS: visual model inline marks/links; byte-faithful unchanged roundtrip; isolated edits preserve YAML/unknown HTML/tables/CRLF; escaped Markdown serialization; blank/YAML-only file typing retained");
 }
}
