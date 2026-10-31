using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using Spire.Core;
namespace Spire.Windows;
public partial class MainWindow
{
 async void MoveFolder(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null||Files.SelectedItem is not NavigationNode{FileId:null} node)return;
  await SaveDraft();var fields=NativeDialogs.Form(this,"Move / rename folder",[("Destination path",node.Path,false)],"Move");if(fields is null)return;
  await workspace.MoveFolderAsync(node.Path,fields[0]);session.ReloadSaved();ShowDraft();Refresh();
 });
 async void Backup(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();
  var picker=new Microsoft.Win32.SaveFileDialog{Title="Back up complete workspace",Filter="Spire backup|*.spirebackup",FileName="Spire-workspace.spirebackup"};if(picker.ShowDialog(this)!=true)return;
  await workspace.ExportBackupAsync(picker.FileName);MessageBox.Show(this,"Backup saved. It contains files, Trash, metadata, attachments, pending changes and conflicts. Store it privately; it is not encrypted.","Workspace backup");
 });
 async void RestoreBackup(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null||session is null)return;await SaveDraft();
  var picker=new Microsoft.Win32.OpenFileDialog{Title="Restore workspace backup",Filter="Spire backup|*.spirebackup"};if(picker.ShowDialog(this)!=true)return;
  // Validate completely before asking to replace state or touching the current workspace.
  _=await WorkspaceArchive.ReadAsync(picker.FileName);
  if(MessageBox.Show(this,"Replace this local workspace with the backup? A safety backup of the current workspace will be saved first. No server changes happen until explicit Sync.","Restore workspace",MessageBoxButton.OKCancel,MessageBoxImage.Warning)!=MessageBoxResult.OK)return;
  var recovery=Path.Combine(Root,"Recovery");Directory.CreateDirectory(recovery);await workspace.ExportBackupAsync(Path.Combine(recovery,"before-restore-"+Guid.NewGuid().ToString("N")+".spirebackup"));
  await workspace.RestoreBackupAsync(picker.FileName);server?.Dispose();server=null;connection="Offline — restored backup";session=new WritingSession(workspace);ShowDraft();Refresh();
 });
 async void ImportFiles(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(workspace is null)return;await SaveDraft();var picker=new Microsoft.Win32.OpenFileDialog{Title="Import Markdown files",Filter="Markdown|*.md",Multiselect=true};if(picker.ShowDialog(this)!=true)return;
  var fields=NativeDialogs.Form(this,"Import files",[("Destination folder","Imported",false)],"Import");if(fields is null)return;
  var imported=new List<(string Path,string Content)>();var utf8=new UTF8Encoding(false,true);
  foreach(var path in picker.FileNames){if(new FileInfo(path).Length>4_000_000)throw new InvalidDataException("Import file exceeds the supported size.");imported.Add((fields[0]+"/"+Path.GetFileName(path),await File.ReadAllTextAsync(path,utf8)));}
  await workspace.ImportMarkdownAsync(imported);Refresh();
 });
 async void ExportFile(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  if(session?.CurrentId is null)return;await SaveDraft();var picker=new Microsoft.Win32.SaveFileDialog{Title="Export Markdown",Filter="Markdown|*.md",FileName=Path.GetFileName(session.Path)};if(picker.ShowDialog(this)!=true)return;
  var temporary=picker.FileName+"."+Guid.NewGuid().ToString("N")+".tmp";
  try{await File.WriteAllTextAsync(temporary,session.Content,new UTF8Encoding(false));File.Move(temporary,picker.FileName,true);}finally{if(File.Exists(temporary))File.Delete(temporary);}
 });
 async void QuickActions(object sender,RoutedEventArgs e)
 {
  if(busy)return;
  var choice=NativeDialogs.Gallery(this,"Quick actions",[("new","New file","Create a local file",17d),("save","Save","Persist current writing",17d),("import","Import Markdown","Add files without overwriting existing paths",17d),("export","Export current file","Portable Markdown",17d),("backup","Back up workspace","Full local state and attachments",17d),("restore","Restore backup","Safety backup before replacement",17d),("map","Map","File relationships",17d),("sync","Sync","Explicit server synchronization",17d),("settings","Settings","Local editor preferences",17d)]);
  if(choice is null)return;
  switch(choice){case "new":NewFile(sender,e);break;case "save":SaveFile(sender,e);break;case "import":ImportFiles(sender,e);break;case "export":ExportFile(sender,e);break;case "backup":Backup(sender,e);break;case "restore":RestoreBackup(sender,e);break;case "map":Map(sender,e);break;case "sync":Sync(sender,e);break;case "settings":Settings(sender,e);break;}
  await Task.CompletedTask;
 }
 sealed record EditorPreferences(double FontSize,bool Wrap);
 EditorPreferences preferences=new(17,true);
 void LoadPreferences()
 {
  var path=Path.Combine(Root,"editor-preferences.json");if(!File.Exists(path))return;
  try{var loaded=JsonSerializer.Deserialize<EditorPreferences>(File.ReadAllText(path));if(loaded is not null&&loaded.FontSize>=10&&loaded.FontSize<=40){preferences=loaded;ApplyPreferences();}}
  catch(Exception error)when(error is IOException or JsonException){Status.Text="Editor preferences could not be loaded; defaults retained.";}
 }
 void ApplyPreferences(){Editor.FontSize=preferences.FontSize;Editor.TextWrapping=preferences.Wrap?TextWrapping.Wrap:TextWrapping.NoWrap;Writing.FontSize=preferences.FontSize;Writing.Document.FontSize=preferences.FontSize;}
 void Settings(object sender,RoutedEventArgs e)
 {
  if(busy)return;
  var choice=NativeDialogs.Gallery(this,"Settings",[("server","Server connection","Connect explicitly; Local files remain separate",17d),("editor","Editor settings","Font size and source text wrapping",17d)]);
  if(choice=="server")Connect(sender,e);else if(choice=="editor")EditorSettings(sender,e);
 }
 async void EditorSettings(object sender,RoutedEventArgs e)=>await Run(async()=>
 {
  var fields=NativeDialogs.Form(this,"Editor settings",[("Font size (10–40)",preferences.FontSize.ToString(System.Globalization.CultureInfo.InvariantCulture),false),("Wrap source text (true/false)",preferences.Wrap?"true":"false",false)],"Apply");if(fields is null)return;
  if(!double.TryParse(fields[0],System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out var size)||!double.IsFinite(size)||size<10||size>40||!bool.TryParse(fields[1],out var wrap))throw new ArgumentException("Use a font size from 10 to 40 and true/false for wrapping.");
  Directory.CreateDirectory(Root);var path=Path.Combine(Root,"editor-preferences.json");var tmp=path+".tmp";var next=new EditorPreferences(size,wrap);await File.WriteAllTextAsync(tmp,JsonSerializer.Serialize(next));File.Move(tmp,path,true);preferences=next;ApplyPreferences();
 });
 void KeyboardActions(object sender,KeyEventArgs e)
 {
  if(busy)return;
  if(Keyboard.Modifiers==ModifierKeys.Control&&e.Key==Key.S){e.Handled=true;SaveFile(sender,new RoutedEventArgs());}
  else if(Keyboard.Modifiers==(ModifierKeys.Control|ModifierKeys.Shift)&&e.Key==Key.P){e.Handled=true;QuickActions(sender,new RoutedEventArgs());}
 }
}
