using System.ComponentModel;
using System.IO;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Spire.Core;
namespace Spire.Windows;
public partial class MainWindow : Window
{
 static readonly string Root=Environment.GetEnvironmentVariable("SPIRE_TEST_WORKSPACE")??System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TM Wrath","Spire");
 static string? SmokeReportPath=>Environment.GetEnvironmentVariable("SPIRE_SMOKE_REPORT");
 // Fail closed: a smoke run may only touch a disposable workspace under the system Temp directory,
 // and the check must run BEFORE any workspace storage is opened by the Loaded handler.
 static bool SmokeWorkspaceIsolated()
 {
  var path=Environment.GetEnvironmentVariable("SPIRE_TEST_WORKSPACE");
  if(string.IsNullOrWhiteSpace(path))return false;
  try
  {
   var full=System.IO.Path.GetFullPath(path.Trim());
   var temp=System.IO.Path.GetTempPath();
   return full.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&full.Length>temp.Length;
  }
  catch{return false;}
 }
 NativeWorkspace? workspace;WritingSession? session;ServerClient? server;
 bool busy,closing,refreshing,trash,sourceMode;
 string connection="Offline",navigationMode="files";
 public MainWindow()
 {
  InitializeComponent();
  if(SmokeReportPath is not null&&!SmokeWorkspaceIsolated())
  {
   try{System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(SmokeReportPath)!);System.IO.File.WriteAllText(SmokeReportPath,"FAIL: runtime smoke requires an isolated SPIRE_TEST_WORKSPACE under the system Temp directory; no workspace was opened and nothing was modified.");}catch{}
   MessageBox.Show("Runtime smoke requires an isolated SPIRE_TEST_WORKSPACE under the system Temp directory. Nothing was opened.","Spire — isolated runtime smoke",MessageBoxButton.OK,MessageBoxImage.Error);
   Environment.Exit(1);
  }
  Loaded+=async(_,_)=>{await Run(async()=>{workspace=await NativeWorkspace.OpenAsync(new NativeWorkspaceStore(System.IO.Path.Combine(Root,"native")));session=new(workspace);LoadPreferences();Refresh();ShowDraft();});if(SmokeReportPath is not null)await RunRuntimeSmoke();};
 }
 async Task Run(Func<Task> action)
 {
  if(busy)return;busy=true;Shell.IsEnabled=false;
  try{await action();}
  catch(Exception e){Status.Text="Not completed — "+e.Message;MessageBox.Show(this,e.Message,"Spire — draft retained",MessageBoxButton.OK,MessageBoxImage.Warning);}
  finally{busy=false;Shell.IsEnabled=workspace is not null;}
 }
 void CaptureDraft(){if(!sourceMode)Editor.Text=Writing.ExportSource();session?.Update(FilePath.Text,Editor.Text);}
 void ToggleWriting(object sender,RoutedEventArgs e)
 {
  if(busy)return;try{CaptureDraft();if(sourceMode)Writing.LoadSource(Editor.Text,CurrentStyleRules());sourceMode=!sourceMode;Editor.Visibility=sourceMode?Visibility.Visible:Visibility.Collapsed;Writing.Visibility=sourceMode?Visibility.Collapsed:Visibility.Visible;EditorLabel.Text=sourceMode?"Markdown source":"Native writing • protected blocks retain their original source";}catch(Exception error){MessageBox.Show(this,error.Message,"Draft retained");}
 }
 async Task SaveDraft(){if(session is null)return;CaptureDraft();await session.SaveAsync();if(Editor.Text!=session.Content||FilePath.Text!=session.Path)ShowDraft();}
 void ShowDraft()
 {
  FilePath.Text=session?.Path??"";Editor.Text=session?.Content??"";
  var current=workspace?.State.VisibleFiles().FirstOrDefault(f=>f.Id==session?.CurrentId);
  Editor.IsReadOnly=current is null||current.Deleted;FilePath.IsReadOnly=Editor.IsReadOnly;
  Writing.LoadSource(Editor.Text,CurrentStyleRules());Writing.IsReadOnly=Editor.IsReadOnly;
  TrashAction.Content=current?.Deleted==true?"Restore file":"Trash file";
 }
 void Refresh()
 {
  if(workspace is null)return;
  refreshing=true;
  try
  {
   var folders=workspace.State.Folders();
   Files.ItemsSource=navigationMode switch
   {
    "tags"=>PortableMetadata.TagNavigation(workspace.State.VisibleFiles(),Search.Text),
    "templates"=>AvailableTemplates().Where(t=>t.Title.Contains(Search.Text,StringComparison.OrdinalIgnoreCase)).Select(t=>new NavigationNode(t.Title,t.Id,null,[])).ToArray(),
    "sources"=>Library(navigationMode).Where(item=>item.GetProperty("title").GetString()!.Contains(Search.Text,StringComparison.OrdinalIgnoreCase)).Select(item=>new NavigationNode(item.GetProperty("title").GetString()!,item.GetProperty("id").GetString()!,null,[])).ToArray(),
    _=>WorkspaceNavigation.Build(workspace.State.VisibleFiles(),folders,Search.Text,trash)
   };
   CreateFolderAction.Visibility=MoveFolderAction.Visibility=DeleteFolderAction.Visibility=navigationMode=="files"&&!trash?Visibility.Visible:Visibility.Collapsed;
   TrashToggle.Content=navigationMode=="sources"?"Delete source":trash?"Active files":"Trash";
   AddAction.Content=navigationMode=="templates"?"Add template":navigationMode=="sources"?"Add source":"Add file";
   int count=workspace.State.VisibleFiles().Count(f=>!f.Deleted);
   int pending=workspace.State.Outbox.Count+workspace.State.MetadataOutbox.Count+workspace.State.FolderOutbox.Count+workspace.State.StyleOutbox.Count+workspace.State.PendingActivations.Count+(workspace.State.QuickActionOrder is null?0:1);
   Status.Text=$"{connection} • {count} {(count==1?"file":"files")} • {pending} pending changes • {workspace.State.Conflicts.Count+workspace.State.MetadataConflicts.Count+workspace.State.FolderConflicts.Count} conflicts • saved locally";
  }finally{refreshing=false;}
 }
 async void SaveFile(object sender,RoutedEventArgs e)=>await Run(async()=>{await SaveDraft();Refresh();});
 async void NewFile(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;await SaveDraft();
  if(navigationMode=="templates"){await EditLibraryRecord("templates",LibraryRules.NewRecord("templates"),true);Refresh();return;}
  if(navigationMode=="sources"){await EditLibraryRecord("sources",LibraryRules.NewRecord("sources"),true);Refresh();return;}
   var parent=navigationMode=="files"?(Files.SelectedItem as NavigationNode)?.Path??"Writing":"Writing";
  if(navigationMode=="files"&&(Files.SelectedItem as NavigationNode)?.FileId is not null)parent=parent.Contains('/')?parent[..parent.LastIndexOf('/')]:"Writing";
  var fields=NativeDialogs.Form(this,"Create file",[("Folder/filename.md",parent+"/Untitled.md",false)],"Create");if(fields is null)return;
  var choice=NativeDialogs.Gallery(this,"New file — starting content",AvailableTemplates().Select(t=>(t.Id,t.Title,t.Category+" • "+t.Description,17d)).Prepend(("\0blank","Blank file","Start without a template",17d)));if(choice is null)return;
  var template=choice=="\0blank"?null:NativeTemplates.For("",fields[0]).Concat(AvailableTemplates().Where(t=>t.Id.StartsWith("saved-",StringComparison.Ordinal))).Single(t=>t.Id==choice);
  var file=new ServerFile(Guid.NewGuid(),0,fields[0],template?.Content??"",false,"",JsonSerializer.SerializeToElement(Array.Empty<object>()),template is null?[]:[template.Id]);
  await workspace.EditAsync(file);await session.OpenAsync(file.Id);Refresh();ShowDraft();
 });
 async void SelectFile(object sender,RoutedPropertyChangedEventArgs<object> e)
 {
  if(refreshing||busy)return;
  if(navigationMode is "templates" or "sources"&&e.NewValue is NavigationNode node)
  {
   await Run(async()=>
   {
    await SaveDraft();
    if(navigationMode=="templates"&&!node.Path.StartsWith("saved-",StringComparison.Ordinal)){NativeDialogs.Inspect(this,"Built-in template — "+node.Label,AvailableTemplates().Single(t=>t.Id==node.Path).Content);return;}
    var recordId=navigationMode=="templates"?node.Path[6..]:node.Path;
    var record=Library(navigationMode).Single(i=>i.GetProperty("id").GetString()==recordId);await EditLibraryRecord(navigationMode,record);Refresh();
   });return;
  }
  if(e.NewValue is not NavigationNode{FileId:Guid id}||id==session?.CurrentId)return;
  await Run(async()=>{CaptureDraft();await session!.OpenAsync(id);ShowDraft();});
 }
 async void TrashFile(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session?.CurrentId is not Guid id)return;await SaveDraft();
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==id);
  await workspace.EditAsync(file with{Deleted=!file.Deleted});session.ReloadSaved();await session.OpenAsync(null);ShowDraft();Refresh();
 });
 async void ToggleTrash(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  await SaveDraft();
  if(navigationMode=="sources")
  {
   if(Files.SelectedItem is not NavigationNode node)return;
   var source=Library("sources").Single(s=>s.GetProperty("id").GetString()==node.Path);
   if(MessageBox.Show(this,"Delete source “"+source.GetProperty("title").GetString()+"”? This is permanent after synchronization. Sources cited in files or Trash cannot be deleted.","Delete source",MessageBoxButton.OKCancel,MessageBoxImage.Warning)!=MessageBoxResult.OK)return;
   await workspace!.DeleteLibraryAsync("sources",node.Path);Refresh();return;
  }
  await session!.OpenAsync(null);trash=!trash;ShowDraft();Refresh();
 });
 async void Home(object sender,RoutedEventArgs e)=>await Run(async()=>{await SaveDraft();await session!.OpenAsync(null);ShowDraft();Refresh();});
 void SearchChanged(object sender,TextChangedEventArgs e){if(!busy)Refresh();}
 void ToggleSidebar(object sender,RoutedEventArgs e){bool visible=Sidebar.Visibility==Visibility.Visible;Sidebar.Visibility=visible?Visibility.Collapsed:Visibility.Visible;SidebarColumn.Width=new GridLength(visible?0:280);}
 async void AdoptPreview(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var preview=new WorkspaceStore(System.IO.Path.Combine(Root,"offline-preview"));var files=LocalFiles.Decode((await preview.LoadAsync()).ServerSnapshot);
  if(files.Count==0){MessageBox.Show(this,"No preview files to adopt. The preview workspace was not changed.","Adopt preview");return;}
  if(MessageBox.Show(this,$"Copy {files.Count} preview files into this native workspace? The original preview remains untouched. Adopted files become pending sync changes. Any identity/path collision cancels the entire import.","Adopt preview",MessageBoxButton.OKCancel)!=MessageBoxResult.OK)return;
  await workspace.AdoptPreviewAsync(files);Refresh();
 });
 async void Connect(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var w=NativeDialogs.Window(this,"Connect to Spire",620,460);var stack=new StackPanel{Margin=new Thickness(22)};
  stack.Children.Add(new TextBlock{Text="Explicit connection only. Local drafts are preserved on sign-in failure. This development client synchronizes files; metadata editing and attachment sync are not accepted yet.",TextWrapping=TextWrapping.Wrap});
  stack.Children.Add(new TextBlock{Text="HTTPS server origin",Margin=new Thickness(4,16,4,0)});var origin=NativeDialogs.Field("https://");stack.Children.Add(origin);
  stack.Children.Add(new TextBlock{Text="Username"});var user=NativeDialogs.Field();stack.Children.Add(user);
  stack.Children.Add(new TextBlock{Text="Password"});var password=new PasswordBox{Margin=new Thickness(4),Padding=new Thickness(8)};stack.Children.Add(password);
  stack.Children.Add(NativeDialogs.Button("Cancel",(_,_)=>w.DialogResult=false));stack.Children.Add(NativeDialogs.Button("Sign in",(_,_)=>w.DialogResult=true));w.Content=stack;if(w.ShowDialog()!=true)return;
  var candidate=new ServerClient(new Uri(origin.Text));
  try
  {
   var identity=await candidate.LoginAsync(user.Text,password.Password,"Spire native Windows");password.Clear();
   // Check account ownership before installing this session; no remote mutations occur on login.
   workspace.State.BindOwner(identity.GetProperty("owner").GetString()!);
   server?.Dispose();server=candidate;connection="Connected (sync manually)";Refresh();
  }catch{candidate.Dispose();password.Clear();throw;}
 });
 async void Sync(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(server is null)throw new InvalidOperationException("Connect explicitly before synchronizing.");
  await SaveDraft();connection="Synchronizing";Refresh();
  try{await workspace!.SyncAsync(server);session!.ReloadSaved();ShowDraft();connection=workspace.State.MetadataConflicts.Count>0?"Sync needs conflict resolution":"Synchronized";}
  catch{connection="Sync failed — local changes retained";throw;}
  finally{Refresh();}
 });
 async void Conflicts(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;await SaveDraft();
   foreach(var conflict in workspace.State.FolderConflicts.ToArray())
   {
    NativeDialogs.Inspect(this,"Folder conflict — "+conflict.Operation.Path,conflict.Reason+"\n\nOperation: "+(conflict.Operation.Delete?"delete empty folder":"create folder"));
    var choice=NativeDialogs.Gallery(this,"Resolve folder conflict",[("retry","Retry local folder action","Empty-folder guards will be checked again",16d),("remote","Accept server folder state","Discard this retained folder operation explicitly",16d)]);if(choice is null)break;
    await workspace.ResolveFolderAsync(conflict.Operation.Id,choice=="retry");
   }
   foreach(var conflict in workspace.State.MetadataConflicts.ToArray())
   {
    NativeDialogs.Inspect(this,"Library conflict — "+conflict.Operation.Collection,conflict.Reason+"\n\nLOCAL\n"+JsonSerializer.Serialize(conflict.Operation.Value,new JsonSerializerOptions{WriteIndented=true})+"\nSERVER\n"+(conflict.Remote?.GetRawText()??"Removed"));
    bool creation=conflict.Operation.Kind=="create"&&conflict.Operation.Collection=="sources";
    string localLabel,localHint,remoteLabel,remoteHint;
    if(conflict.Operation.Collection=="quickActions"&&conflict.Operation.Kind=="order")
    {localLabel="Retry local action order";localHint="Queue this arrangement against the current server order";remoteLabel="Accept server order";remoteHint="Discard this retained reorder explicitly";}
    else if(conflict.Operation.Collection=="quickActions"&&conflict.Operation.Kind=="activate")
    {localLabel="Retry file creation";localHint="Replay the same retained operation identity; the hosted server replays it idempotently";remoteLabel="Discard retained activation";remoteHint="No file is created; the retained request is dropped explicitly";}
    else if(creation)
    {localLabel=conflict.Remote is null?"Explicitly retry source creation":"Adopt matching server source";localHint=conflict.Remote is null?"The prior request may have succeeded. Inspect Sources first: retry can create a duplicate.":"Bind local citations to this server identity; do not send another POST.";remoteLabel="Discard local source draft";remoteHint="Blocked if files or Trash still cite this provisional source.";}
    else
    {localLabel="Keep local library record";localHint="Queue against the current server revision";remoteLabel="Accept server library record";remoteHint="Discard this retained local metadata edit";}
    var choice=NativeDialogs.Gallery(this,"Resolve library conflict",[(("local"),localLabel,localHint,16d),(("remote"),remoteLabel,remoteHint,16d)]);if(choice is null)break;
    await workspace.ResolveLibraryAsync(conflict.Operation.Id,choice=="local");
   }
   foreach(var c in workspace.State.Conflicts.ToArray())
  {
   var mutation=c.GetProperty("mutation").Deserialize<FileMutation>(SyncWorkspace.Json)!;
   var remote=workspace.State.Snapshot is null?null:workspace.State.Snapshot.Value.GetProperty("notes").Deserialize<ServerFile[]>(SyncWorkspace.Json)!.FirstOrDefault(f=>f.Id==mutation.Id);
   NativeDialogs.Inspect(this,"Conflict — local and server content",$"LOCAL: {mutation.Path}\n{mutation.Content}\n\nSERVER revision {remote?.Rev}\n{remote?.Content}");
   var choice=NativeDialogs.Gallery(this,"Resolve conflict",[("local","Keep local","Queue local content against current server revision",17),("server","Use server","Discard the retained conflict draft explicitly",17)]);
   if(choice is null)break;await workspace.ResolveAsync(c.GetProperty("id").GetString()!,choice=="local");
  }
  session.ReloadSaved();ShowDraft();Refresh();
 });
 SourceRange? Selection()
 {
  if(session?.CurrentId is null||Editor.IsReadOnly)return null;
  if(sourceMode)return new(Editor.Text,Editor.SelectionStart,Editor.SelectionLength);
  var range=Writing.SourceSelection();Editor.Text=range.Content;return range;
 }
 void Apply(SourceRange before,SourceEdit edit)
 {
  if(Editor.Text!=before.Content)throw new InvalidOperationException("The file changed while this chooser was open. Nothing was inserted.");
  Editor.Text=edit.Content;Editor.Select(edit.Start,edit.Length);
  if(!sourceMode)Writing.LoadSource(edit.Content);
  if(sourceMode)Editor.Focus();else Writing.Focus();CaptureDraft();
 }
 void TextStyle(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;
  var choice=NativeDialogs.Gallery(this,"Text style",[("bold","Bold","Strong emphasis",20),("italic","Italic","Emphasis",18),("underline","Underline (HTML)","<u>text</u>",17),("strike","Strikethrough","~~text~~",17),("code","Inline code","`text`",17)]);
  var markers=choice switch{"bold"=>("**","**"),"italic"=>("*","*"),"underline"=>("<u>","</u>"),"strike"=>("~~","~~"),"code"=>("`","`"),_=>("","")};if(choice is not null)Apply(r,PortableAuthoring.Wrap(r,markers.Item1,markers.Item2));
 }
 void Headings(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;
  var choices=new List<(string,string,string,double)>{("0","Normal text","Paragraph",17)};
  for(int i=1;i<=6;i++)choices.Add((i.ToString(),"Heading "+i,"The beginning of a chapter",32-i*2));
  var choice=NativeDialogs.Gallery(this,"Headings",choices);if(choice is not null)Apply(r,PortableAuthoring.Heading(r,int.Parse(choice)));
 }
 void Blocks(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;
  var kind=NativeDialogs.Gallery(this,"Blocks",[("code","Code","A fenced code block",17),("quote","Quote","A quoted passage",17)]);if(kind is null)return;
  var fields=kind=="code"?new[]{("Code",r.Content.Substring(r.Start,r.Length),true),("Language (optional)","",false)}:new[]{("Quote",r.Content.Substring(r.Start,r.Length),true)};
  var value=NativeDialogs.Form(this,"Insert "+kind,fields);if(value is null)return;
  var block=PortableAuthoring.Block(kind,value[0],value.Length>1?value[1]:"");
  Apply(r,PortableAuthoring.Replace(r,"\n\n"+block+"\n\n"));
 }
 void Highlight(object sender,RoutedEventArgs e){var r=Selection();if(r is null||r.Length==0)return;Apply(r,PortableAuthoring.Wrap(r,"==","=="));}
 void Table(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;var table=NativeDialogs.Table(this);if(table is null)return;
  Apply(r,PortableAuthoring.Replace(r,"\n\n"+PortableAuthoring.Table(Guid.NewGuid().ToString(),table.Value.Cells,table.Value.Alignments)+"\n\n"));
 }
 void Link(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;var value=NativeDialogs.Form(this,"Insert link",[("Label",r.Content.Substring(r.Start,r.Length),false),("URL or relative file path","",false)]);if(value is null||string.IsNullOrWhiteSpace(value[1]))return;
  var label=value[0].Replace("\\","\\\\").Replace("[","\\[").Replace("]","\\]").Replace("\n"," ");
  Apply(r,PortableAuthoring.Replace(r,"["+label+"]("+value[1].Replace(" ","%20").Replace("(","%28").Replace(")","%29")+")"));
 }
 void DateTimeGallery(object sender,RoutedEventArgs e)
 {
  var r=Selection();if(r is null)return;
  var now=DateTime.Now;
  var formats=new[]{"yyyy-MM-dd","MMMM d, yyyy","ddd, MMM d, yyyy","dd/MM/yyyy","HH:mm","HH:mm:ss","h:mm tt","h:mm:ss tt"};
  var format=NativeDialogs.Gallery(this,"Date & time",formats.Select(f=>(f,f,now.ToString(f,CultureInfo.InvariantCulture),17d)));if(format is null)return;
  var choice=NativeDialogs.Gallery(this,"Insert date & time",[("current","Current",now.ToString(format,CultureInfo.InvariantCulture),17),("manual","Manual","Choose the value before insertion",17)]);if(choice is null)return;
  if(choice=="manual")
  {
   var values=NativeDialogs.Form(this,"Manual date & time",[("ISO value (yyyy-MM-dd or HH:mm:ss)",format.Contains('y')?now.ToString("yyyy-MM-dd"):now.ToString("HH:mm:ss"),false)]);if(values is null)return;
   if(!DateTime.TryParseExact(values[0],new[]{"yyyy-MM-dd","HH:mm:ss","HH:mm"},CultureInfo.InvariantCulture,DateTimeStyles.None,out now)){MessageBox.Show(this,"Enter an ISO date or time.","No insertion");return;}
  }
  Apply(r,PortableAuthoring.Replace(r,now.ToString(format,CultureInfo.InvariantCulture)));
 }
 async void Dictionary(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;await SaveDraft();
  if(Editor.Text.Contains("spire_type: dictionary"))
  {
   var values=NativeDialogs.Form(this,"Add definition",[("Term","",false),("Definition","",true)],"Add definition");if(values is null)return;
   var file=workspace.State.VisibleFiles().Single(f=>f.Id==session.CurrentId);await workspace.EditAsync(file with{Content=PortableAuthoring.AppendDefinition(file.Content,values[0],values[1])});session.ReloadSaved();ShowDraft();Refresh();return;
  }
  var fields=NativeDialogs.Form(this,"Create dictionary",[("Folder/filename.md","Dictionaries/Terms.md",false),("Title","Terms",false)],"Create dictionary");if(fields is null)return;
  var created=new ServerFile(Guid.NewGuid(),0,fields[0],PortableAuthoring.Dictionary(fields[1]),false,"",JsonSerializer.SerializeToElement(Array.Empty<object>()));await workspace.EditAsync(created);await session.OpenAsync(created.Id);ShowDraft();Refresh();
 });
 async void History(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session?.CurrentId is not Guid id)return;await SaveDraft();
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==id);var history=file.History.ValueKind==JsonValueKind.Array?file.History.EnumerateArray().ToArray():[];
  if(history.Length==0){MessageBox.Show(this,"No server revisions are available for this file. Local unsynchronized edits are not server history.","Revision history");return;}
  var selected=NativeDialogs.Gallery(this,"Revision history",history.Reverse().Select(h=>(h.GetProperty("rev").GetInt32().ToString(),"Revision "+h.GetProperty("rev").GetInt32(),h.GetProperty("time").GetString()??"",17d)));if(selected is null)return;
  var revision=history.Single(h=>h.GetProperty("rev").GetInt32()==int.Parse(selected));NativeDialogs.Inspect(this,"Revision "+selected,revision.GetProperty("content").GetString()??"");
  if(MessageBox.Show(this,"Restore this revision as a new pending edit? The current server revision is preserved in history.","Restore revision",MessageBoxButton.OKCancel)!=MessageBoxResult.OK)return;
  await workspace.EditAsync(file with{Path=revision.GetProperty("path").GetString()!,Content=revision.GetProperty("content").GetString()!,Deleted=false});session!.ReloadSaved();ShowDraft();Refresh();
 });
 async Task ChangeNavigation(string mode)=>await Run(async()=>{await SaveDraft();navigationMode=mode;trash=false;Refresh();});
 async void CreateFolder(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var fields=NativeDialogs.Form(this,"Create folder",[("Folder path","",false)],"Create folder");if(fields is null)return;
  await workspace.CreateFolderAsync(fields[0]);Refresh();
 });
 async void DeleteFolder(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||navigationMode!="files"||trash||Files.SelectedItem is not NavigationNode{FileId:null} node)return;await SaveDraft();
  bool occupied=workspace.State.VisibleFiles().Any(f=>!f.Deleted&&f.Path.StartsWith(node.Path+"/",StringComparison.OrdinalIgnoreCase))||workspace.State.Folders().Any(p=>p.StartsWith(node.Path+"/",StringComparison.OrdinalIgnoreCase));
  if(!occupied){await workspace.DeleteEmptyFolderAsync(node.Path);Refresh();return;}
  var count=workspace.State.VisibleFiles().Count(f=>!f.Deleted&&f.Path.StartsWith(node.Path+"/",StringComparison.OrdinalIgnoreCase));
  if(MessageBox.Show(this,$"Move {count} files in ‘{node.Path}’ to recoverable Trash and remove its folders? Attachments/styles inside the folder block this operation. Existing Trash is untouched.","Trash folder",MessageBoxButton.OKCancel,MessageBoxImage.Warning)!=MessageBoxResult.OK)return;
  await workspace.TrashFolderAsync(node.Path);session!.ReloadSaved();ShowDraft();Refresh();
 });
 async void FilesTab(object sender,RoutedEventArgs e)=>await ChangeNavigation("files");
 async void TagsTab(object sender,RoutedEventArgs e)=>await ChangeNavigation("tags");
 async void TemplatesTab(object sender,RoutedEventArgs e)=>await ChangeNavigation("templates");
 async void SourcesTab(object sender,RoutedEventArgs e)=>await ChangeNavigation("sources");
 async void Properties(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session?.CurrentId is not Guid id||Editor.IsReadOnly)return;await SaveDraft();
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==id);var metadata=PortableMetadata.Read(file.Content);
  if(metadata.Error is not null)throw new InvalidDataException(metadata.Error);
  var choices=metadata.Properties.Where(p=>!PortableMetadata.Reserved(p.Key)).Select(p=>(p.Key,p.Key,p.Value.ToString(),17d)).Prepend(("\0new","Add property","Text, number, checkbox, date or list",17d));
  var selected=NativeDialogs.Gallery(this,"File properties",choices);if(selected is null)return;
  string? old=selected=="\0new"?null:selected;
  var operation=NativeDialogs.Gallery(this,"Property action",[("edit","Edit value","Preserve all other properties and writing",17),("delete","Delete property","Remove only this property",17)]);if(operation is null)return;
  string? key=null;object? value=null;
  if(operation=="edit")
  {
   var type=NativeDialogs.Gallery(this,"Property type",[("text","Text","A string value",17),("number","Number","A finite number",17),("checkbox","Checkbox","true or false",17),("date","Date","yyyy-MM-dd",17),("list","List","One item per line",17)]);if(type is null)return;
   var fields=NativeDialogs.Form(this,"Edit property",[("Name",old??"",false),("Value",old is null?"":metadata.Properties[old].ToString(),type=="list")],"Apply");if(fields is null)return;key=fields[0];
   value=type switch
   {
    "text"=>fields[1],
    "list"=>fields[1].Split(['\r','\n'],StringSplitOptions.RemoveEmptyEntries).Select(x=>x.Trim()).Where(x=>x.Length>0).ToArray(),
    "checkbox" when fields[1] is "true" or "false"=>fields[1]=="true",
    "number" when double.TryParse(fields[1],NumberStyles.Float,CultureInfo.InvariantCulture,out var number)&&double.IsFinite(number)=>number,
    "date" when DateTime.TryParseExact(fields[1],"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out _)=>fields[1],
    _=>throw new ArgumentException("Enter a valid value for this property type.")
   };
  }
  else if(old is null)return;
  var content=PortableMetadata.ChangeProperty(file.Content,old,key,value);
  await workspace.EditAsync(file with{Content=content});session.ReloadSaved();ShowDraft();Refresh();
 });
 async void Star(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session?.CurrentId is not Guid id||Editor.IsReadOnly)return;await SaveDraft();
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==id);var properties=PortableMetadata.Read(file.Content).Properties;
  bool starred=properties.TryGetValue("starred",out var current)&&current.ToString()=="true";
  await workspace.EditAsync(file with{Content=PortableMetadata.ChangeProperty(file.Content,properties.ContainsKey("starred")?"starred":null,starred?null:"starred",starred?null:true)});
  session.ReloadSaved();ShowDraft();Refresh();
 });
 async void SaveAsTemplate(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session?.CurrentId is null||Editor.IsReadOnly)return;await SaveDraft();
  var record=JsonNode.Parse(LibraryRules.NewRecord("templates").GetRawText())!.AsObject();record["content"]=session.Content;record["sourcePath"]=session.Path;record["title"]=System.IO.Path.GetFileNameWithoutExtension(session.Path);
  await EditLibraryRecord("templates",JsonSerializer.SerializeToElement(record),true);Refresh();
 });
 Task EditLibraryRecord(string collection,JsonElement record,bool create=false)
 {
  var w=new Window{Owner=this,Title=create?(collection=="templates"?"Create template":"Create source"):collection=="templates"?"Edit template":"Edit source",Width=720,Height=720,WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=Brushes.Black,Foreground=Brushes.White};
  var root=new DockPanel{Margin=new Thickness(16)};var actions=new StackPanel{Orientation=Orientation.Horizontal};var save=new Button{Content="Save locally",Padding=new Thickness(12,6,12,6)};var cancel=new Button{Content="Cancel",Margin=new Thickness(8,0,0,0)};actions.Children.Add(save);actions.Children.Add(cancel);DockPanel.SetDock(actions,Dock.Bottom);root.Children.Add(actions);
  var feedback=new TextBlock{Text="Changes are durable offline and synchronize explicitly. Identity, revision and unknown metadata remain protected.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,0,0,12)};DockPanel.SetDock(feedback,Dock.Top);root.Children.Add(feedback);
  var fields=new Dictionary<string,TextBox>();var panel=new StackPanel();
  foreach(var pair in LibraryRules.Fields(collection))
  {
   panel.Children.Add(new TextBlock{Text=pair.Key,Foreground=Brushes.Gray,Margin=new Thickness(0,8,0,3)});
   var editor=new TextBox{Text=record.TryGetProperty(pair.Key,out var value)?value.GetString()??"":"",MaxLength=pair.Value,AcceptsReturn=pair.Key is "content" or "description",TextWrapping=TextWrapping.Wrap,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,MinHeight=pair.Key is "content" or "description"?120:30,MaxHeight=300,Background=new SolidColorBrush(Color.FromRgb(25,25,25)),Foreground=Brushes.White,Padding=new Thickness(6)};fields[pair.Key]=editor;panel.Children.Add(editor);
  }
  root.Children.Add(new ScrollViewer{Content=panel,VerticalScrollBarVisibility=ScrollBarVisibility.Auto});w.Content=root;bool saving=false;
  save.Click+=async(_,__)=>
  {
   if(saving)return;saving=true;save.IsEnabled=cancel.IsEnabled=false;
   try{var changed=JsonNode.Parse(record.GetRawText())!.AsObject();foreach(var field in fields)changed[field.Key]=field.Value.Text;if(create)await workspace!.CreateLibraryAsync(collection,JsonSerializer.SerializeToElement(changed));else await workspace!.EditLibraryAsync(collection,JsonSerializer.SerializeToElement(changed));saving=false;w.DialogResult=true;}
   catch(Exception ex){feedback.Text=ex.Message+" The editor stays open and your draft is retained.";}
   finally{saving=false;save.IsEnabled=cancel.IsEnabled=true;}
  };
  cancel.Click+=(_,__)=>w.Close();w.Closing+=(_,e)=>{if(saving)e.Cancel=true;};w.ShowDialog();return Task.CompletedTask;
 }
 IReadOnlyList<NativeTemplate> AvailableTemplates()
 {
  var content=session?.Content??"";var path=string.IsNullOrEmpty(session?.Path)?"General/Untitled.md":session.Path;
  return NativeTemplates.For(content,path).Concat(Library("templates").Select(t=>new NativeTemplate("saved-"+t.GetProperty("id").GetString(),t.GetProperty("title").GetString()!,t.GetProperty("category").GetString()!,t.GetProperty("content").GetString()!,t.GetProperty("sourcePath").GetString()??""))).ToArray();
 }
 IReadOnlyList<JsonElement> Library(string name)
 {
  return workspace?.State.Library(name)??[];
 }
 async void Citation(object sender,RoutedEventArgs e)=>await Run(()=>
 {
  var range=Selection();if(range is null)return Task.CompletedTask;
  var sources=Library("sources");
  if(sources.Count==0){MessageBox.Show(this,"No sources are available. Open the Sources tab and choose Add source; sources and citations can be created offline.","Sources");return Task.CompletedTask;}
  var selected=NativeDialogs.Gallery(this,"Sources — choose citation",sources.Select(s=>(s.GetProperty("id").GetString()!,s.GetProperty("title").GetString()!,s.GetProperty("kind").GetString()+" • "+s.GetProperty("author").GetString(),17d)));if(selected is null)return Task.CompletedTask;
  var source=sources.Single(s=>s.GetProperty("id").GetString()==selected);
  var fields=NativeDialogs.Form(this,"Insert citation",[("Locator (page, chapter or timestamp)","",false),("Quotation (optional)",range.Content.Substring(range.Start,range.Length),true)]);if(fields is null)return Task.CompletedTask;
  Apply(range,PortableAuthoring.Replace(range,PortableCitations.Insert(source,FilePath.Text,fields[0],fields[1])));return Task.CompletedTask;
 });
 async void InsertTemplate(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;var range=Selection();if(range is null)return;
  var templates=AvailableTemplates();
  var selected=NativeDialogs.Gallery(this,"Insert template",templates.Select(t=>(t.Id,t.Title,t.Category+" • "+t.Description,17d)));if(selected is null)return;
  var template=templates.Single(t=>t.Id==selected);
  NativeDialogs.Inspect(this,"Template preview — no changes",template.Content);
  if(MessageBox.Show(this,"Insert this template before the captured selection? No existing writing is replaced, and YAML remains intact.","Insert template",MessageBoxButton.OKCancel)!=MessageBoxResult.OK)return;
  // Match hosted sidebar insertion: insert at the bookmark, never replace selected text or YAML.
  var edit=NativeTemplates.Insert(range.Content,range.Start,template.Content);
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==session.CurrentId);
  await workspace.EditAsync(file with{Path=FilePath.Text,Content=edit.Content,TemplateIds=(file.TemplateIds??[]).Append(selected).Distinct().ToArray()});
  session.ReloadSaved();ShowDraft();sourceMode=true;Editor.Visibility=Visibility.Visible;Writing.Visibility=Visibility.Collapsed;EditorLabel.Text="Markdown source";Editor.Select(edit.Start,edit.Length);Editor.Focus();Refresh();
 });
 async void Map(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;await SaveDraft();
  var graph=NativeMapGraph.Build(workspace.State.VisibleFiles());
  var window=NativeDialogs.Window(this,"File relationships — native sphere",960,720);var view=new NativeMapView(graph);Guid? selected=null;
  view.FileOpened+=id=>{selected=id;window.DialogResult=true;};window.Content=view;window.ShowDialog();
  if(selected is Guid id){await session.OpenAsync(id);ShowDraft();Refresh();}
 });
 async void Media(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;var range=Selection();if(range is null)return;
  var kind=NativeDialogs.Gallery(this,"Media",[("image","Image — Markdown","![description](relative/path)",17),("audio","Audio — HTML","<audio controls src=\"relative/path\"></audio>",17),("video","Video — HTML","<video controls src=\"relative/path\"></video>",17),("file","Attachment — Markdown","[attachment](relative/path)",17)]);if(kind is null)return;
  var picker=new Microsoft.Win32.OpenFileDialog{Title="Select local attachment",CheckFileExists=true};if(picker.ShowDialog(this)!=true)return;
  var info=new System.IO.FileInfo(picker.FileName);if(info.Length==0||info.Length>10_000_000)throw new ArgumentException("Choose a nonempty attachment no larger than 10 MB.");
  var extension=info.Extension.ToLowerInvariant();
  if(kind=="image"&&!new[]{".png",".jpg",".jpeg",".gif",".webp"}.Contains(extension)||kind=="audio"&&!new[]{".mp3",".wav",".ogg",".m4a",".webm"}.Contains(extension)||kind=="video"&&!new[]{".mp4",".webm",".ogv"}.Contains(extension))throw new ArgumentException("Choose a file format matching the selected media type.");
  var path="Attachments/"+Guid.NewGuid().ToString("N")+extension;
  LocalFiles.ValidatePortablePath(path);
  var relative=string.Concat(Enumerable.Repeat("../",FilePath.Text.Split('/').Length-1))+path;
  var markup=kind switch{"image"=>"![image]("+relative+")","audio"=>"<audio controls src=\""+relative+"\"></audio>","video"=>"<video controls src=\""+relative+"\"></video>",_=>"[attachment]("+relative+")"};
  var edit=PortableAuthoring.Replace(range,markup);
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==session.CurrentId) with{Path=FilePath.Text,Content=edit.Content};
  // Disk commit first: a failed attachment transaction leaves the exact visible draft and selection intact.
  await workspace.AttachAsync(file,path,await System.IO.File.ReadAllBytesAsync(picker.FileName));session.ReloadSaved();ShowDraft();Editor.Select(edit.Start,edit.Length);Refresh();
 });
 async void OnClosing(object? sender,CancelEventArgs e)
 {
  if(closing)return;e.Cancel=true;if(busy||session is null)return;
  await Run(async()=>{await SaveDraft();closing=true;server?.Dispose();Close();});
 }
}
