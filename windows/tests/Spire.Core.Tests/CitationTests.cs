using Spire.Core;
using System.Text.Json;
static class CitationTests
{
 public static void Run()
 {
  var id=Guid.NewGuid();var source=JsonSerializer.SerializeToElement(new{id,title="A [book]",author="Ty",year="2026"});
  var expected="[Ty, A \\[book\\], 2026, p. 4](../../Sources/"+id+".md)";
  if(PortableCitations.Insert(source,"Writing/Draft/Chapter.md","p. 4","")!=expected)throw new Exception("Citation not source-compatible or portable");
  var quote=PortableCitations.Insert(source,"Writing/File.md","","first\n\nlast");
  if(!quote.StartsWith("\n\n> first\n> \n> last\n>\n> — ")||!quote.EndsWith("\n\n"))throw new Exception("Quote/attribution serialization differs from hosted source");
  bool bad=false;try{PortableCitations.Insert(source,"Writing/File.md",new string('x',301),"");}catch(ArgumentException){bad=true;}if(!bad)throw new Exception("Oversize locator accepted");
  var content=expected+"\n`"+expected+"`\n```md\n"+expected+"\n```\n<!-- "+expected+" -->\n"+expected;
  var references=PortableCitations.Read(content);if(references.Count!=2||references.Any(c=>c.SourceId!=id)||references[0].Start!=0||references[0].Length!=expected.Length)throw new Exception("Citation source spans or code/comment masking failed");
  var rebased=PortableCitations.Rebase(content,"Writing/File.md");
  if(rebased!=content.Remove(references[1].Start,references[1].Length).Insert(references[1].Start,expected.Replace("../../Sources/","../Sources/")).Remove(0,expected.Length).Insert(0,expected.Replace("../../Sources/","../Sources/")))throw new Exception("Citation rebasing changed examples or source content");
  Console.WriteLine("PASS: source-compatible citations; nested relative paths; escaped labels; multiline attribution; locator limits; exact source spans; rename rebasing excludes code/comments");
 }
}
