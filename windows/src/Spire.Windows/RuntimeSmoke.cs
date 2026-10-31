using System.IO;
using System.Windows;
using System.Windows.Documents;
using Spire.Core;
namespace Spire.Windows;
public partial class MainWindow
{
 async Task RunRuntimeSmoke()
 {
  var report=Environment.GetEnvironmentVariable("SPIRE_SMOKE_REPORT");if(string.IsNullOrEmpty(report))return;
  int code=0;
  try
  {
   if(Environment.GetEnvironmentVariable("SPIRE_TEST_WORKSPACE") is not string path||string.IsNullOrWhiteSpace(path)||!SmokeWorkspaceIsolated())throw new InvalidOperationException("Smoke testing requires an isolated test workspace under the system Temp directory.");
   var source="---\nunknown: preserved\n---\n# Heading\n\nA **bold** paragraph.\n\n```csharp\nvar x = 1;\n```\n";
   Writing.LoadSource(source);if(Writing.ExportSource()!=source)throw new Exception("Native writing roundtrip changed source.");
   var paragraph=Writing.Document.Blocks.OfType<Paragraph>().Last();paragraph.Inlines.Add(new Run(" Added writing."));
   var changed=Writing.ExportSource();if(!changed.Contains("Added writing.")||!changed.Contains("var x = 1;")||!changed.Contains("unknown: preserved"))throw new Exception("Native typing lost protected content.");
   var file=new ServerFile(Guid.NewGuid(),0,"Runtime/Smoke.md",changed,false,"",System.Text.Json.JsonSerializer.SerializeToElement(Array.Empty<object>()));
   await workspace!.EditAsync(file);await session!.OpenAsync(file.Id);ShowDraft();Refresh();
   if(FilePath.Text!="Runtime/Smoke.md"||!Writing.ExportSource().Contains("Added writing."))throw new Exception("Native selection/load failed.");
   await SaveDraft();await workspace.CreateFolderAsync("Runtime");await workspace.MoveFolderAsync("Runtime","Moved");session.ReloadSaved();ShowDraft();Refresh();
   if(FilePath.Text!="Moved/Smoke.md")throw new Exception("Native folder move/reload failed.");
   var backup=Path.Combine(path,"runtime.spirebackup");await workspace.ExportBackupAsync(backup);await workspace.RestoreBackupAsync(backup);
   var reopened=await NativeWorkspace.OpenAsync(new NativeWorkspaceStore(Path.Combine(path,"native")));
   if(reopened.State.VisibleFiles().Single().Path!="Moved/Smoke.md")throw new Exception("Native runtime restart persistence failed.");
   Directory.CreateDirectory(Path.GetDirectoryName(report)!);await File.WriteAllTextAsync(report,"PASS: actual Windows WPF launch, source-preserving visual typing, native file selection, save, folder move/reload, backup/restore and restart persistence. Isolated workspace; no production/server access.");
  }
  catch(Exception error){code=1;await File.WriteAllTextAsync(report,"FAIL: "+error);}
  finally{closing=true;System.Windows.Application.Current.Shutdown(code);}
 }
}
