using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Spire.Core;
namespace Spire.Windows;

// WPF-only projection; no HTML engine, remote fetch, shell launch or Markdown rewriting.
public static class NativeMarkdownRenderer
{
 static readonly Brush Muted=new SolidColorBrush(Color.FromRgb(48,48,48));
 public static FrameworkElement Render(string source)
 {
  var document=new FlowDocument{PagePadding=new Thickness(8),FontFamily=new FontFamily("Segoe UI"),FontSize=17,Foreground=Brushes.White,Background=Brushes.Transparent};
  foreach(var block in NativeMarkdownPreview.Parse(source))document.Blocks.Add(RenderBlock(block));
  return new FlowDocumentScrollViewer{Document=document,Background=Brushes.Transparent,IsToolBarVisible=false,VerticalScrollBarVisibility=ScrollBarVisibility.Disabled,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled};
 }
 static Paragraph Paragraph(PreviewBlock block)
 {
  var p=new Paragraph{Margin=new Thickness(0,0,0,10)};
  foreach(var mark in block.Runs)
  {
   var run=new Run(mark.Text){FontWeight=mark.Bold?FontWeights.Bold:FontWeights.Normal,FontStyle=mark.Italic?FontStyles.Italic:FontStyles.Normal};
   if(mark.Strike)run.TextDecorations=TextDecorations.Strikethrough;
   if(mark.Code){run.FontFamily=new FontFamily("Consolas");run.Background=Muted;}
   if(mark.Highlight){run.Background=Brushes.LightGoldenrodYellow;run.Foreground=Brushes.Black;}
   // Link styling, but deliberately no automatic external navigation from a preview.
   if(mark.Link is not null){run.TextDecorations=TextDecorations.Underline;run.ToolTip=mark.Link;}
   p.Inlines.Add(run);
  }
  if(block.Runs.Count==0)p.Inlines.Add(new Run(block.Text));
  if(block.Kind=="heading"){p.FontSize=34-block.Level*2;p.FontWeight=FontWeights.SemiBold;}
  return p;
 }
 static Block RenderBlock(PreviewBlock block)
 {
  switch(block.Kind)
  {
   case "paragraph":case "heading":return Paragraph(block);
   case "quote":
    var quote=new Section{BorderBrush=Brushes.Gray,BorderThickness=new Thickness(3,0,0,0),Padding=new Thickness(14,4,4,4),Margin=new Thickness(0,4,0,12)};
    foreach(var nested in block.Children)quote.Blocks.Add(RenderBlock(nested));return quote;
   case "list":
    var list=new System.Windows.Documents.List{MarkerStyle=block.Level==1?TextMarkerStyle.Decimal:TextMarkerStyle.Disc,Padding=new Thickness(24,0,0,0),Margin=new Thickness(0,0,0,12)};
    if(block.Level==1&&int.TryParse(block.Text,out int start)&&start>0)list.StartIndex=start;
    foreach(var nested in block.Children){var item=new ListItem();foreach(var child in nested.Children)item.Blocks.Add(RenderBlock(child));if(item.Blocks.Count==0)item.Blocks.Add(new Paragraph());list.ListItems.Add(item);}return list;
   case "table":
    var table=new Table{CellSpacing=0,Margin=new Thickness(0,4,0,16)};var rows=new TableRowGroup();table.RowGroups.Add(rows);
    int count=block.Children.Select(r=>r.Children.Count).DefaultIfEmpty(0).Max();for(int i=0;i<count;i++)table.Columns.Add(new TableColumn());
    foreach(var row in block.Children)
    {
     var result=new TableRow();rows.Rows.Add(result);
     foreach(var cell in row.Children)
     {
      var tc=new TableCell{BorderBrush=Brushes.Gray,BorderThickness=new Thickness(.5),Padding=new Thickness(9),TextAlignment=cell.Alignment switch{"right"=>TextAlignment.Right,"center"=>TextAlignment.Center,_=>TextAlignment.Left}};
      if(row.Level==1){tc.Background=Muted;tc.FontWeight=FontWeights.SemiBold;}
      foreach(var child in cell.Children)tc.Blocks.Add(RenderBlock(child));if(tc.Blocks.Count==0)tc.Blocks.Add(new Paragraph());result.Cells.Add(tc);
     }
    }
    return table;
   case "rule":return new BlockUIContainer(new Border{Height=1,Background=Brushes.Gray,Margin=new Thickness(0,8,0,8)});
   case "code":return new Paragraph(new Run(block.Text)){FontFamily=new FontFamily("Consolas"),FontSize=14,Background=Muted,Padding=new Thickness(12),Margin=new Thickness(0,4,0,12)};
   default:return new Paragraph(new Run(block.Text)){FontFamily=new FontFamily("Consolas"),FontSize=14,Foreground=Brushes.LightGray,Margin=new Thickness(0,4,0,12)};
  }
 }
}
