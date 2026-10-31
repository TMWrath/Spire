using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using Spire.Core;
namespace Spire.Windows;

// Native WPF document surface. Original source slices survive until their own block changes.
public sealed class NativeWritingView : RichTextBox
{
 RichWritingDocument model=RichWritingDocument.Parse("");
 readonly Dictionary<int,string> baselines=[];
 public NativeWritingView()
 {
  Background=new SolidColorBrush(Color.FromRgb(25,25,25));Foreground=Brushes.White;BorderBrush=new SolidColorBrush(Color.FromRgb(68,68,68));
  Padding=new Thickness(24);FontFamily=new FontFamily("Segoe UI");FontSize=17;VerticalScrollBarVisibility=ScrollBarVisibility.Auto;
  AcceptsTab=true;
  DataObject.AddPastingHandler(this,(_,e)=>
  {
   if(e.DataObject.GetData(DataFormats.UnicodeText) is string text){Selection.Text=text;e.CancelCommand();}
   else e.CancelCommand();
  });
 }
 public void LoadSource(string source,IReadOnlyList<StyleRule>? styleRules=null)
 {
  model=RichWritingDocument.Parse(source);baselines.Clear();var document=new FlowDocument{PagePadding=new Thickness(0),Background=Background,Foreground=Foreground,FontSize=FontSize};
  foreach(var block in model.Blocks)
  {
   if(block.Kind=="protected")
   {
    var panel=new StackPanel();panel.Children.Add(new TextBlock{Text="Preserved Markdown • edit in Source",Foreground=Brushes.Gray,FontSize=12});
    panel.Children.Add(NativeMarkdownRenderer.Render(block.Raw));
    document.Blocks.Add(new BlockUIContainer(panel){Tag=block.Index,Margin=new Thickness(0,8,0,16)});continue;
   }
   var paragraph=new Paragraph{Tag=block.Index,Margin=new Thickness(0,0,0,18)};
   if(block.Kind=="heading"){paragraph.FontSize=34-block.Level*2;paragraph.FontWeight=FontWeights.SemiBold;ApplyStyle(paragraph,styleRules,"h"+block.Level);}
   else ApplyStyle(paragraph,styleRules,"p");
   foreach(var mark in block.Runs)
   {
    var run=new Run(mark.Text){FontWeight=mark.Bold?FontWeights.Bold:FontWeights.Normal,FontStyle=mark.Italic?FontStyles.Italic:FontStyles.Normal};
    if(mark.Strike)run.TextDecorations=TextDecorations.Strikethrough;
    if(mark.Code){run.FontFamily=new FontFamily("Consolas");run.Background=new SolidColorBrush(Color.FromRgb(45,45,45));run.Tag="code";ApplyRunStyle(run,styleRules);}
    if(mark.Link is not null){var link=new Hyperlink(run){Tag=mark.Link,Foreground=Brushes.LightGray};paragraph.Inlines.Add(link);}else paragraph.Inlines.Add(run);
   }
   document.Blocks.Add(paragraph);baselines[block.Index]=ParagraphMarkdown(paragraph,block);
  }
  if(document.Blocks.Count==0)document.Blocks.Add(new Paragraph());Document=document;
 }
 // Native stylesheet projection: a deliberate WPF subset of the hosted per-file CSS. Weight, style and
 // strike are deliberately not projected onto runs because visual export reads those as Markdown marks.
 static void ApplyStyle(Paragraph paragraph,IReadOnlyList<StyleRule>? rules,string tag)
 {
  if(rules is null)return;
  foreach(var declaration in rules.Where(r=>r.Tag==tag&&r.Class is null).SelectMany(r=>r.Declarations))
  {
   switch(declaration.Key)
   {
    case "color":if(TryBrush(declaration.Value,out var color))paragraph.Foreground=color;break;
    case "background" or "background-color":if(TryBrush(declaration.Value,out var background))paragraph.Background=background;break;
    case "font-size":if(TryFontSize(declaration.Value,paragraph.FontSize,out var size))paragraph.FontSize=size;break;
    case "text-align":paragraph.TextAlignment=declaration.Value.Trim().Trim('"','\'').ToLowerInvariant() switch{"left"=>TextAlignment.Left,"center"=>TextAlignment.Center,"right"=>TextAlignment.Right,"justify"=>TextAlignment.Justify,_=>paragraph.TextAlignment};break;
    case "line-height":if(TryLineHeight(declaration.Value,paragraph.FontSize,out var line))paragraph.LineHeight=line;break;
   }
  }
 }
 static void ApplyRunStyle(Run run,IReadOnlyList<StyleRule>? rules)
 {
  if(rules is null)return;
  foreach(var declaration in rules.Where(r=>r.Tag=="code"&&r.Class is null).SelectMany(r=>r.Declarations))
  {
   switch(declaration.Key)
   {
    case "color":if(TryBrush(declaration.Value,out var color))run.Foreground=color;break;
    case "background" or "background-color":if(TryBrush(declaration.Value,out var background))run.Background=background;break;
    case "font-size":if(TryFontSize(declaration.Value,run.FontSize,out var size))run.FontSize=size;break;
    case "text-decoration":if(declaration.Value.Trim().ToLowerInvariant().Contains("underline"))run.TextDecorations=TextDecorations.Underline;break;
   }
  }
 }
 internal static bool TryBrush(string value,out Brush brush)
 {
  brush=Brushes.Transparent;
  try{var color=(System.Windows.Media.Color)ColorConverter.ConvertFromString(value.Trim());brush=new SolidColorBrush(color);brush.Freeze();return true;}
  catch{return false;}
 }
 internal static bool TryFontSize(string value,double basis,out double size)
 {
  size=0;value=value.Trim().Trim('"','\'');
  if(value.EndsWith("px",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var px))size=px;
  else if(value.EndsWith("pt",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var pt))size=pt*4/3;
  else if(value.EndsWith("em",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var em))size=basis*em;
  else if(value.EndsWith('%')&&double.TryParse(value[..^1],out var percent))size=basis*percent/100;
  else return false;
  if(double.IsNaN(size)||size<6||size>200)return false;
  return true;
 }
 internal static bool TryLineHeight(string value,double basis,out double height)
 {
  height=0;value=value.Trim().Trim('"','\'');
  if(double.TryParse(value,out var factor))height=basis*factor;
  else if(value.EndsWith("px",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var px))height=px;
  else if(value.EndsWith("pt",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var pt))height=pt*4/3;
  else if(value.EndsWith('%')&&double.TryParse(value[..^1],out var percent))height=basis*percent/100;
  else if(value.EndsWith("em",StringComparison.OrdinalIgnoreCase)&&double.TryParse(value[..^2],out var em))height=basis*em;
  else return false;
  if(double.IsNaN(height)||height<6||height>400)return false;
  return true;
 }
 static IEnumerable<WritingRun> Runs(InlineCollection inlines,string? link=null)
 {
  foreach(var inline in inlines)
  {
   if(inline is Run run)yield return new(run.Text,run.FontWeight>=FontWeights.Bold,run.FontStyle==FontStyles.Italic,run.TextDecorations?.Contains(TextDecorations.Strikethrough[0])==true,run.Tag as string=="code",link);
   else if(inline is LineBreak)yield return new("\n");
   else if(inline is Span span)foreach(var item in Runs(span.Inlines,span is Hyperlink h?h.Tag as string:link))yield return item;
  }
 }
 static string ParagraphMarkdown(Paragraph paragraph,WritingBlock block)
 {
  return (block.Kind=="heading"?new string('#',block.Level)+" ":"")+RichWritingDocument.InlineMarkdown(Runs(paragraph.Inlines));
 }
 public string ExportSource()
 {
  if(model.Blocks.Count==0)return string.Join("\n\n",Document.Blocks.OfType<Paragraph>().Select(p=>RichWritingDocument.InlineMarkdown(Runs(p.Inlines))));
  var edits=model.Blocks.Select(b=>b.Portable).ToArray();var present=new HashSet<int>();var groups=new Dictionary<int,List<string>>();int previous=-1;
  foreach(var block in Document.Blocks)
  {
   int index=block.Tag is int id?id:previous;
   if(index<0)throw new InvalidOperationException("Use Source to insert before the first protected block. Your visual draft is retained.");
   previous=index;present.Add(index);
   if(block is Paragraph p)
   {
    var text=ParagraphMarkdown(p,model.Blocks[index]);
    if(!groups.TryGetValue(index,out var items))groups[index]=items=[];items.Add(text);
   }
  }
  foreach(var block in model.Blocks)
  {
   if(!present.Contains(block.Index))
   {
    if(block.Kind=="protected")throw new InvalidOperationException("Protected Markdown cannot be removed visually. Use Source; the visual draft is retained.");
    edits[block.Index]="";
   }
   else if(groups.TryGetValue(block.Index,out var items))
   {
    var portable=string.Join("\n\n",items);
    if(portable!=baselines.GetValueOrDefault(block.Index))edits[block.Index]=portable;
   }
  }
  return model.Serialize(edits);
 }
 public SourceRange SourceSelection()
 {
  var source=ExportSource();var parsed=RichWritingDocument.Parse(source);
  int Offset(TextPointer pointer,bool trailing)
  {
   var paragraph=pointer.Paragraph;if(paragraph is null)throw new InvalidOperationException("Select protected content in Source.");
   int index=Document.Blocks.TakeWhile(b=>b!=paragraph).Count();
   if(index>=parsed.Blocks.Count||parsed.Blocks[index].Kind=="protected"||string.Concat(Runs(paragraph.Inlines).Select(r=>r.Text))!=string.Concat(parsed.Blocks[index].Runs.Select(r=>r.Text)))
    throw new InvalidOperationException("This selection crosses restructured or protected content. Switch to Source; your writing is retained.");
   int offset=new TextRange(paragraph.ContentStart,pointer).Text.Replace("\r\n","\n").Length;
   return parsed.PlainOffset(index,offset,trailing);
  }
  int start=Offset(Selection.Start,false),end=Selection.IsEmpty?start:Offset(Selection.End,true);return new(source,Math.Min(start,end),Math.Abs(end-start));
 }
}
