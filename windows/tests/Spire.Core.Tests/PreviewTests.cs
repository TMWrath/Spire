using Spire.Core;
static class PreviewTests
{
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static void Run()
 {
  var blocks=NativeMarkdownPreview.Parse("# Heading\n\n> A **quotation**\n>\n> Second paragraph\n\n- Alpha\n- Beta\n\n1. First\n2. Second\n\n```cs\nvar x = \"<script>\";\n```\n\n| A | B |\n| :--- | ---: |\n| x | y |\n\n---\n\n==bright== and ~~gone~~\n\n<script>alert('no')</script>\n");
  Check(blocks[0].Kind=="heading"&&blocks[0].Level==1,"Preview heading missing");
  var quote=blocks.Single(b=>b.Kind=="quote");Check(quote.Children.Count==2&&quote.Children[0].Runs.Any(r=>r.Bold&&r.Text=="quotation"),"Nested quote lost emphasis/paragraphs");
  var lists=blocks.Where(b=>b.Kind=="list").ToArray();Check(lists.Length==2&&lists[0].Level==0&&lists[1].Level==1&&lists.All(b=>b.Children.Count==2),"List structure lost");
  Check(blocks.Single(b=>b.Kind=="code").Text=="var x = \"<script>\";","Code text interpreted as HTML");
  var table=blocks.Single(b=>b.Kind=="table");Check(table.Children.Count==2&&table.Children[0].Children.Count==2&&table.Children[0].Children[0].Text=="A"&&table.Children[1].Children[1].Text=="y"&&table.Children[0].Children[1].Alignment=="right","Table cells/alignment lost");
  Check(blocks.Any(b=>b.Kind=="rule"),"Horizontal rule absent");
  Check(blocks.Where(b=>b.Kind=="paragraph").SelectMany(b=>b.Runs).Any(r=>r.Highlight&&r.Text=="bright"),"Highlight not projected");
  Check(blocks.Any(b=>b.Kind=="opaque"&&b.Text.Contains("<script>")),"Unknown HTML not safely opaque");
  var original="> protected\r\n\r\n- first\r\n- second\r\n";var rich=RichWritingDocument.Parse(original);_=NativeMarkdownPreview.Parse(original);Check(rich.Serialize(rich.Blocks.Select(b=>b.Portable).ToArray())==original,"Rendering rewrote original bytes");
  Console.WriteLine("PASS: native preview projection headings, nested quotes/emphasis, numbered/bullet lists, inert code/HTML, aligned tables, rules/highlights and byte-preserving protected source");
 }
}
