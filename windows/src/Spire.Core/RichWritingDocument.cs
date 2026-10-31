using System.Text;
using System.Text.RegularExpressions;
using Markdig;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
namespace Spire.Core;
public sealed record WritingRun(string Text,bool Bold=false,bool Italic=false,bool Strike=false,bool Code=false,string? Link=null,int SourceStart=-1,int SourceLength=0);
public sealed record WritingBlock(int Index,string Kind,int Level,int Start,int Length,string Raw,string Portable,IReadOnlyList<WritingRun> Runs);
public sealed class RichWritingDocument
{
 static readonly MarkdownPipeline Pipeline=new MarkdownPipelineBuilder().UseAdvancedExtensions().UsePreciseSourceLocation().Build();
 public string Source {get;}
 public IReadOnlyList<WritingBlock> Blocks {get;}
 RichWritingDocument(string source,IReadOnlyList<WritingBlock> blocks){Source=source;Blocks=blocks;}
 public static RichWritingDocument Parse(string source)
 {
  var body=PortableMetadata.Read(source).Body;var prefix=source.Length-body.Length;
  var syntax=Markdown.Parse(body,Pipeline);var result=new List<WritingBlock>();
  foreach(var block in syntax)
  {
   var start=prefix+block.Span.Start;var length=block.Span.End-block.Span.Start+1;
   if(start<0||length<0||start+length>source.Length)throw new InvalidDataException("Markdown source span is invalid.");
   var raw=source.Substring(start,length);var runs=new List<WritingRun>();
   var kind=block is HeadingBlock?"heading":block is ParagraphBlock?"paragraph":"protected";
   // Keep dialects/HTML/images/math/reference constructs opaque rather than rewriting their meaning.
   if(Regex.IsMatch(raw,@"!?\[\[|\[\^|\[!|==|\$|!\[|\^[\w-]+(?:\r?\n|$)|<(?!\/?u>)[A-Za-z!/]|&(?:\w+|#\d+);"))kind="protected";
   if(kind!="protected"&&block is LeafBlock leaf&&leaf.Inline is not null)
   {
    bool valid=true;
    void Visit(ContainerInline container,WritingRun mark)
    {
     foreach(var inline in container)
     {
      switch(inline)
      {
       case LiteralInline literal:runs.Add(mark with{Text=literal.Content.ToString(),SourceStart=prefix+literal.Span.Start,SourceLength=literal.Span.Length});break;
       case CodeInline code:runs.Add(mark with{Text=code.Content,Code=true,SourceStart=prefix+code.Span.Start,SourceLength=code.Span.Length});break;
       case LineBreakInline line:runs.Add(mark with{Text="\n",SourceStart=prefix+line.Span.Start,SourceLength=line.Span.Length});break;
       case EmphasisInline emphasis:Visit(emphasis,mark with{Bold=mark.Bold||emphasis.DelimiterCount==2&&emphasis.DelimiterChar!='~',Italic=mark.Italic||emphasis.DelimiterCount==1,Strike=mark.Strike||emphasis.DelimiterChar=='~'});break;
       case LinkInline link when !link.IsImage&&!link.IsAutoLink&&link.Reference is null:Visit(link,mark with{Link=link.Url});break;
       default:valid=false;break;
      }
     }
    }
    Visit(leaf.Inline,new(""));if(!valid)kind="protected";
   }
   result.Add(new(result.Count,kind,block is HeadingBlock h?h.Level:0,start,length,raw,raw,runs));
  }
  if(result.Count==0)result.Add(new(0,"paragraph",0,source.Length,0,"","",[]));
  return new(source,result);
 }
 public string Serialize(IReadOnlyList<string> portable)
 {
  if(portable.Count!=Blocks.Count)throw new ArgumentException("Visual block identity changed; use Source to restructure protected content.");
  var text=new StringBuilder(Source);
  for(int i=Blocks.Count-1;i>=0;i--)
  {
   var block=Blocks[i];if(portable[i]==block.Portable)continue;
   if(block.Kind=="protected")throw new InvalidOperationException("Protected content must be edited in Source.");
   var value=portable[i];if(block.Raw.Contains("\r\n"))value=value.Replace("\r\n","\n").Replace("\n","\r\n");
   text.Remove(block.Start,block.Length).Insert(block.Start,value);
  }
  return text.ToString();
 }
 public int PlainOffset(int index,int offset,bool trailing=false)
 {
  var block=Blocks[index];if(block.Kind=="protected")throw new InvalidOperationException("Select protected content in Source.");
  var total=block.Runs.Sum(r=>r.Text.Length);if(offset<0||offset>total)throw new ArgumentOutOfRangeException(nameof(offset));
  if(block.Runs.Count==0)return block.Start;
  foreach(var run in block.Runs)
  {
   if((offset>run.Text.Length||offset==run.Text.Length&&!trailing)&&run!=block.Runs[^1]){offset-=run.Text.Length;continue;}
   var raw=Source.Substring(run.SourceStart,run.SourceLength);
   if(run.Code)return run.SourceStart+raw.IndexOf(run.Text,StringComparison.Ordinal)+offset;
   int position=0;for(int seen=0;seen<offset&&position<raw.Length;seen++,position++)if(raw[position]=='\\'&&position+1<raw.Length)position++;
   return run.SourceStart+position;
  }
  return block.Start+block.Length;
 }
 public static string InlineMarkdown(IEnumerable<WritingRun> runs)
 {
  var result=new StringBuilder();
  foreach(var run in runs)
  {
   var value=Regex.Replace(run.Text,@"([\\`*_\[\]<>~])",@"\$1");
   if(run.Code){var fence=new string('`',Math.Max(1,Regex.Matches(run.Text,"`+").Select(m=>m.Length+1).DefaultIfEmpty(1).Max()));value=fence+(run.Text.StartsWith('`')||run.Text.EndsWith('`')?" "+run.Text+" ":run.Text)+fence;}
   if(run.Bold)value="**"+value+"**";if(run.Italic)value="*"+value+"*";if(run.Strike)value="~~"+value+"~~";
   if(run.Link is not null)value="["+value+"]("+run.Link.Replace(" ","%20").Replace("(","%28").Replace(")","%29")+")";
   result.Append(value);
  }
  return result.ToString();
 }
}
