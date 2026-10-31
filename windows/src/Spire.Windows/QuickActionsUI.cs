using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Spire.Core;
namespace Spire.Windows;
public partial class MainWindow
{
 IReadOnlyList<StyleRule>? CurrentStyleRules()
 {
  if(workspace is null||session?.CurrentId is null)return null;
  var file=workspace.State.VisibleFiles().FirstOrDefault(f=>f.Id==session.CurrentId);
  if(file is null||file.Deleted)return null;
  try
  {
   var css=workspace.State.Style(QuickActionRules.StylePath(file.Path));
   return css is null?null:QuickActionRules.ParseRules(css);
  }
  catch{return null;}
 }
 // Hosted parity: Settings › Actions — create, edit, delete, reorder and one-tap file activation.
 async void QuickActionsManager(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var window=NativeDialogs.Window(this,"Quick actions",820,620);
  var status=new TextBlock{TextWrapping=TextWrapping.Wrap,Foreground=Brushes.Gray,Margin=new Thickness(4,10,4,2)};
  var list=new ListBox{Background=new SolidColorBrush(Color.FromRgb(21,21,21)),Foreground=Brushes.White,BorderThickness=new Thickness(0),Padding=new Thickness(4)};
  void Repopulate()
  {
   list.Items.Clear();
   var actions=workspace.State.Library("quickActions");
   foreach(var action in actions)
   {
    var id=action.GetProperty("id").GetString()!;
    var label=action.GetProperty("label").GetString()!;
    var folder=action.GetProperty("folder").GetString();
    var pattern=action.GetProperty("namePattern").GetString();
    var templateId=action.TryGetProperty("templateId",out var template)&&template.ValueKind==JsonValueKind.String?template.GetString():null;
    // Hosted settings parity: unknown templates render as "Template unavailable", blank as "Blank file".
    var templateLabel=templateId is null?"Blank file":TemplateTitle(templateId)??"Template unavailable";
    list.Items.Add(new ListBoxItem{Content=$"{label}  •  {folder}/{pattern}  •  {templateLabel}",Tag=id,Foreground=Brushes.White});
   }
   status.Text=workspace.State.QuickActionOrder is null?string.Empty:"A reordered action list is pending synchronization.";
   if(actions.Count==0)status.Text="No quick actions yet. Add one to create files with one tap.";
  }
  string? TemplateTitle(string templateId)
  {
   if(templateId.StartsWith("saved-",StringComparison.Ordinal))
   {
    var saved=Library("templates").FirstOrDefault(t=>t.GetProperty("id").GetString()==templateId["saved-".Length..]);
    return saved.ValueKind==JsonValueKind.Undefined?null:saved.GetProperty("title").GetString();
   }
   return NativeTemplates.For("","General/Untitled.md").FirstOrDefault(t=>t.Id==templateId)?.Title;
  }
  async Task Attempt(string description,Func<Task> action)
  {
   try{await action();Repopulate();Refresh();}
   catch(Exception error){status.Text=error.Message;}
  }
  var buttons=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(2)};
  Window Button(string text,RoutedEventHandler handler)
  {
   var button=NativeDialogs.Button(text,handler);buttons.Children.Add(button);return window;
  }
  Button("Create file",async(_,_)=>await Attempt("activate",async()=>
  {
   if(list.SelectedItem is not ListBoxItem item||item.Tag is not string id)return;
   if(server is null)throw new InvalidOperationException("Connect explicitly before creating files with a quick action.");
   if(session is null)throw new InvalidOperationException("Open the workspace editor before creating files with a quick action.");
   var action=Guid.Parse(id);
   await workspace.SyncAsync(server);
   var record=await workspace.ActivateQuickActionAsync(server,action);
   await session.OpenAsync(record.NoteId);trash=false;ShowDraft();Refresh();
   status.Text="Created "+record.Path;
  }));
  Button("Add action",async(_,_)=>await Attempt("create",async()=>{if(await EditQuickAction(null))Repopulate();}));
  Button("Edit action",async(_,_)=>await Attempt("edit",async()=>
  {
   if(list.SelectedItem is not ListBoxItem item||item.Tag is not string id)return;
   var action=workspace.State.Library("quickActions").Single(a=>a.GetProperty("id").GetString()==id);
   if(await EditQuickAction(action))Repopulate();
  }));
  Button("Delete action",async(_,_)=>await Attempt("delete",async()=>
  {
   if(list.SelectedItem is not ListBoxItem item||item.Tag is not string id)return;
   if(MessageBox.Show(window,"Delete this quick action? The durable deletion synchronizes explicitly.","Quick actions",MessageBoxButton.OKCancel)!=MessageBoxResult.OK)return;
   await workspace.DeleteLibraryAsync("quickActions",id);
  }));
  Button("Move up",async(_,_)=>await Attempt("order",async()=>await MoveSelected(-1)));
  Button("Move down",async(_,_)=>await Attempt("order",async()=>await MoveSelected(1)));
  buttons.Children.Add(NativeDialogs.Button("Close",(_,_)=>window.Close()));
  async Task MoveSelected(int offset)
  {
   if(list.SelectedItem is not ListBoxItem item||item.Tag is not string id)return;
   var ids=workspace.State.Library("quickActions").Select(a=>a.GetProperty("id").GetString()!).ToList();
   var index=ids.IndexOf(id);var target=index+offset;
   if(target<0||target>=ids.Count)return;
   (ids[index],ids[target])=(ids[target],ids[index]);
   await workspace.QueueQuickActionOrderAsync(ids);
  }
  var root=new DockPanel{Margin=new Thickness(16)};
  DockPanel.SetDock(buttons,Dock.Bottom);root.Children.Add(buttons);
  DockPanel.SetDock(status,Dock.Bottom);root.Children.Add(status);
  var head=new TextBlock{Text="Durable offline actions. Activation uses the hosted clean-sync gate and a retained operation identity.",TextWrapping=TextWrapping.Wrap,Foreground=Brushes.Gray,Margin=new Thickness(4,0,4,8)};
  DockPanel.SetDock(head,Dock.Top);root.Children.Add(head);
  root.Children.Add(list);window.Content=root;
  Repopulate();window.ShowDialog();
 });
 async Task<bool> EditQuickAction(JsonElement? existing)
 {
  if(workspace is null)return false;
  var record=existing is null?LibraryRules.NewRecord("quickActions"):existing.Value.Clone();
  string Text(string key)=>record.TryGetProperty(key,out var value)&&value.ValueKind==JsonValueKind.String?value.GetString()!:"";
  var fields=NativeDialogs.Form(this,existing is null?"Create quick action":"Edit quick action",[
   ("Label",Text("label"),false),
   ("Folder",Text("folder"),false),
   ("Filename pattern — {date} and {time} fill in automatically",Text("namePattern"),false)],confirm:existing is null?"Add action":"Save action");
  if(fields is null)return false;
  // Hosted editor parity: the picker offers built-in full templates and saved templates only —
  // the server rejects section templates (header-hero/collapsible) for quick actions.
  var templates=NativeTemplates.Full.Concat(Library("templates").Select(t=>new NativeTemplate("saved-"+t.GetProperty("id").GetString(),t.GetProperty("title").GetString()!,t.GetProperty("category").GetString()!,t.GetProperty("content").GetString()!))).ToArray();
  var choices=new List<(string,string,string,double)>{("blank","Blank file","No template content",17)};
  choices.AddRange(templates.Select(t=>(t.Id,t.Title,t.Category+" template",16d)));
  var chosen=NativeDialogs.Gallery(this,"Template",choices);
  if(chosen is null)return false;
  var updated=JsonNode.Parse(record.GetRawText())!.AsObject();
  updated["label"]=fields[0];updated["folder"]=fields[1];updated["namePattern"]=fields[2];
  updated["templateId"]=chosen=="blank"?null:chosen;
  var value=JsonSerializer.SerializeToElement(updated,SyncWorkspace.Json);
  if(existing is null)await workspace.CreateLibraryAsync("quickActions",value);
  else await workspace.EditLibraryAsync("quickActions",value);
  return true;
 }
 // Hosted parity: per-file CSS tab — stylesheet edits are durable offline and project into native writing.
 async void StylesHandler(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var file=session?.CurrentId is null?null:workspace.State.VisibleFiles().FirstOrDefault(f=>f.Id==session.CurrentId);
  var current=file is null?null:QuickActionRules.StylePath(file.Path);
  var styles=workspace.State.Styles();
  var entries=new List<(string,string,string,double)>();
  if(current is not null)
   entries.Add((current,"Current file stylesheet",styles.TryGetValue(current,out var own)?$"{own.Length} characters — edit":$"Not created yet — add one for {file!.Path}",18));
  foreach(var path in styles.Keys.Where(p=>!string.Equals(p,current,StringComparison.OrdinalIgnoreCase)).OrderBy(p=>p,StringComparer.OrdinalIgnoreCase))
  {
   var attached=workspace.State.VisibleFiles().Any(f=>!f.Deleted&&string.Equals(QuickActionRules.StylePath(f.Path),path,StringComparison.OrdinalIgnoreCase));
   entries.Add((path,path,attached?"Attached":"Unattached — the hosted sidebar lists these separately",16));
  }
  if(entries.Count==0){MessageBox.Show(this,"Open a file to create its stylesheet, or synchronize to fetch existing styles.","Styles");return;}
  var chosen=NativeDialogs.Gallery(this,"Stylesheets",entries);
  if(chosen is null)return;
  var content=styles.TryGetValue(chosen,out var existing)?existing:"";
  var edited=NativeDialogs.Form(this,"Edit stylesheet "+chosen,[("CSS — scoped to this file; imports, URLs and unsafe at-rules are refused",content,true)],confirm:"Save stylesheet");
  if(edited is null)return;
  await workspace.QueueStyleAsync(chosen,edited[0]);
  if(string.Equals(chosen,current,StringComparison.OrdinalIgnoreCase))ShowDraft();
  Refresh();
 });
}
