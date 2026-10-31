using Markdig;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
using Markdig.Extensions.Tables;
namespace Spire.Core;

// An inert, toolkit-independent view projection. Never used to serialize authored source.
public sealed record PreviewRun(string Text,bool Bold=false,bool Italic=false,bool Strike=false,bool Code=false,bool Highlight=false,string? Link=null);
public sealed record PreviewBlock(string Kind,string Text="",int Level=0,string Alignment="left",IReadOnlyList<PreviewRun>? Inline=null,IReadOnlyList<PreviewBlock>? Nested=null)
{
 public IReadOnlyList<PreviewRun> Runs=>Inline??[];
 public IReadOnlyList<PreviewBlock> Children=>Nested??[];
}
public static class NativeMarkdownPreview
{
 static readonly MarkdownPipeline Pipeline=new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();
 public static IReadOnlyList<PreviewBlock> Parse(string source)
 {
  var markdown=Markdown.Parse(PortableMetadata.Read(source).Body,Pipeline);
  PreviewBlock Convert(Block block)
  {
   var children=block is ContainerBlock container?container.Select(Convert).ToArray():[];
   var runs=block is LeafBlock leaf&&leaf.Inline is not null?Inline(leaf.Inline,new("")):[];
   string text=string.Concat(runs.Select(r=>r.Text));
   return block switch
   {
    Table table=>new("table",Nested:children.Select(row=>row with{Nested=row.Children.Select((cell,i)=>cell with{Alignment=table.ColumnDefinitions.ElementAtOrDefault(i)?.Alignment switch{TableColumnAlign.Center=>"center",TableColumnAlign.Right=>"right",_=>"left"}}).ToArray()}).ToArray()),
    TableRow row=>new("row",Level:row.IsHeader?1:0,Nested:children),
    TableCell=>new("cell",Text:string.Concat(children.Select(c=>c.Text)),Nested:children),
    HeadingBlock heading=>new("heading",text,heading.Level,Inline:runs),
    ParagraphBlock=>new("paragraph",text,Inline:runs),
    QuoteBlock=>new("quote",Nested:children),
    ListBlock list=>new("list",Text:list.OrderedStart??"1",Level:list.IsOrdered?1:0,Nested:children),
    ListItemBlock=>new("item",Nested:children),
    CodeBlock code=>new("code",code.Lines.ToString()),
    ThematicBreakBlock=>new("rule"),
    _=>new("opaque",block.Span.Start>=0&&block.Span.End<source.Length?PortableMetadata.Read(source).Body.Substring(block.Span.Start,block.Span.Length):"")
   };
  }
  return markdown.Select(Convert).ToArray();
 }
 static IReadOnlyList<PreviewRun> Inline(ContainerInline container,PreviewRun mark)
 {
  var result=new List<PreviewRun>();
  foreach(var inline in container)
  {
   switch(inline)
   {
    case LiteralInline literal:result.Add(mark with{Text=literal.Content.ToString()});break;
    case CodeInline code:result.Add(mark with{Text=code.Content,Code=true});break;
    case LineBreakInline:result.Add(mark with{Text="\n"});break;
    case EmphasisInline emphasis:
     result.AddRange(Inline(emphasis,mark with{Bold=mark.Bold||emphasis.DelimiterCount==2&&emphasis.DelimiterChar is '*' or '_',Italic=mark.Italic||emphasis.DelimiterCount==1&&emphasis.DelimiterChar is '*' or '_',Strike=mark.Strike||emphasis.DelimiterChar=='~',Highlight=mark.Highlight||emphasis.DelimiterChar=='='}));break;
    case LinkInline link when !link.IsImage:result.AddRange(Inline(link,mark with{Link=link.Url}));break;
    case LinkInline image:result.Add(new("Image: "+string.Concat(Inline(image,new("")).Select(r=>r.Text))));break;
    case HtmlInline html:result.Add(mark with{Text=html.Tag});break;
    case AutolinkInline auto:result.Add(mark with{Text=auto.Url,Link=auto.Url});break;
    case ContainerInline nested:result.AddRange(Inline(nested,mark));break;
    default:result.Add(mark with{Text=inline.ToString()??""});break;
   }
  }
  return result;
 }
}
