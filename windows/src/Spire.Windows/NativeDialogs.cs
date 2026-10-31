using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
namespace Spire.Windows;

// Native modal chooser family. Cancel never writes to the writing session.
static class NativeDialogs
{
 static readonly Brush Background=new SolidColorBrush(Color.FromRgb(20,20,20));
 public static Window Window(Window owner,string title,double width=620,double height=480)=>new(){Owner=owner,Title=title,Width=width,Height=height,MinWidth=380,MinHeight=280,WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=Background,Foreground=Brushes.White};
 public static Button Button(string text,RoutedEventHandler action){var b=new Button{Content=text,Margin=new Thickness(4),Padding=new Thickness(12,8,12,8),Background=new SolidColorBrush(Color.FromRgb(42,42,42)),Foreground=Brushes.White};b.Click+=action;return b;}
 public static TextBox Field(string text="",bool multiline=false)=>new(){Text=text,AcceptsReturn=multiline,TextWrapping=TextWrapping.Wrap,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,Margin=new Thickness(4,6,4,10),Padding=new Thickness(8),Background=new SolidColorBrush(Color.FromRgb(28,28,28)),Foreground=Brushes.White,BorderBrush=Brushes.DimGray,MinHeight=multiline?140:36};
 public static string[]? Form(Window owner,string title,(string Label,string Value,bool Multiline)[] fields,string confirm="Insert")
 {
  var w=Window(owner,title,640,Math.Min(760,200+fields.Length*90+fields.Count(f=>f.Multiline)*130));var shell=new DockPanel{Margin=new Thickness(20)};
  var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};
  actions.Children.Add(Button("Cancel",(_,_)=>w.DialogResult=false));actions.Children.Add(Button(confirm,(_,_)=>w.DialogResult=true));DockPanel.SetDock(actions,Dock.Bottom);shell.Children.Add(actions);
  var panel=new StackPanel();var inputs=new List<TextBox>();
  foreach(var f in fields){panel.Children.Add(new TextBlock{Text=f.Label,Margin=new Thickness(4)});var input=Field(f.Value,f.Multiline);System.Windows.Automation.AutomationProperties.SetName(input,f.Label);inputs.Add(input);panel.Children.Add(input);}
  shell.Children.Add(new ScrollViewer{Content=panel,VerticalScrollBarVisibility=ScrollBarVisibility.Auto});w.Content=shell;
  return w.ShowDialog()==true?inputs.Select(f=>f.Text).ToArray():null;
 }
 public static string? Gallery(Window owner,string title,IEnumerable<(string Id,string Label,string Preview,double Size)> choices)
 {
  var w=Window(owner,title);var stack=new StackPanel{Margin=new Thickness(16)};string? selected=null;
  foreach(var choice in choices){var b=Button(choice.Label+"\n"+choice.Preview,(_,_)=>{selected=choice.Id;w.DialogResult=true;});b.FontSize=choice.Size;b.HorizontalContentAlignment=HorizontalAlignment.Left;stack.Children.Add(b);}
  stack.Children.Add(Button("Cancel",(_,_)=>w.DialogResult=false));w.Content=new ScrollViewer{Content=stack,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};w.ShowDialog();return selected;
 }
 public static (string[][] Cells,string[] Alignments)? Table(Window owner)
 {
  var w=Window(owner,"Create Markdown table",820,640);var shell=new DockPanel{Margin=new Thickness(16)};
  var sizes=new StackPanel{Orientation=Orientation.Horizontal};var rows=new ComboBox{Width=80,Margin=new Thickness(8),ItemsSource=Enumerable.Range(2,19),SelectedItem=3};var cols=new ComboBox{Width=80,Margin=new Thickness(8),ItemsSource=Enumerable.Range(1,10),SelectedItem=3};
  sizes.Children.Add(new TextBlock{Text="Rows",VerticalAlignment=VerticalAlignment.Center});sizes.Children.Add(rows);sizes.Children.Add(new TextBlock{Text="Columns",VerticalAlignment=VerticalAlignment.Center});sizes.Children.Add(cols);DockPanel.SetDock(sizes,Dock.Top);shell.Children.Add(sizes);
  var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};DockPanel.SetDock(actions,Dock.Bottom);shell.Children.Add(actions);
  var grid=new Grid();shell.Children.Add(new ScrollViewer{Content=grid,HorizontalScrollBarVisibility=ScrollBarVisibility.Auto,VerticalScrollBarVisibility=ScrollBarVisibility.Auto});
  var fields=new List<List<TextBox>>();var aligns=new List<ComboBox>();
  void Rebuild()
  {
   if(rows.SelectedItem is not int r||cols.SelectedItem is not int c)return;
   var previous=fields.Select(row=>row.Select(f=>f.Text).ToArray()).ToArray();var alignment=aligns.Select(a=>a.SelectedItem as string??"none").ToArray();
   fields.Clear();aligns.Clear();grid.Children.Clear();grid.RowDefinitions.Clear();grid.ColumnDefinitions.Clear();
   for(int i=0;i<c;i++)grid.ColumnDefinitions.Add(new(){Width=new GridLength(180)});
   for(int i=0;i<=r;i++)grid.RowDefinitions.Add(new(){Height=GridLength.Auto});
   for(int i=0;i<c;i++){var combo=new ComboBox{ItemsSource=new[]{"none","left","center","right"},SelectedItem=i<alignment.Length?alignment[i]:"none",Margin=new Thickness(5)};System.Windows.Automation.AutomationProperties.SetName(combo,$"Column {i+1} alignment");aligns.Add(combo);Grid.SetColumn(combo,i);grid.Children.Add(combo);}
   for(int i=0;i<r;i++){var row=new List<TextBox>();for(int j=0;j<c;j++){var f=Field(i<previous.Length&&j<previous[i].Length?previous[i][j]:"");f.AcceptsReturn=true;f.MinHeight=72;System.Windows.Automation.AutomationProperties.SetName(f,i==0?$"Header {j+1}":$"Row {i}, column {j+1}");row.Add(f);Grid.SetRow(f,i+1);Grid.SetColumn(f,j);grid.Children.Add(f);}fields.Add(row);}
  }
  rows.SelectionChanged+=(_,_)=>Rebuild();cols.SelectionChanged+=(_,_)=>Rebuild();Rebuild();
  actions.Children.Add(Button("Cancel",(_,_)=>w.DialogResult=false));actions.Children.Add(Button("Insert table",(_,_)=>w.DialogResult=true));w.Content=shell;
  return w.ShowDialog()==true?(fields.Select(r=>r.Select(f=>f.Text).ToArray()).ToArray(),aligns.Select(a=>(string)a.SelectedItem).ToArray()):null;
 }
 public static void Inspect(Window owner,string title,string text)
 {
  var w=Window(owner,title,800,600);var field=Field(text,true);field.IsReadOnly=true;field.FontFamily=new FontFamily("Consolas");w.Content=field;w.ShowDialog();
 }
}
