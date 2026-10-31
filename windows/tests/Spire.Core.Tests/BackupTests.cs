using Spire.Core;
using System.Text.Json;
static class BackupTests
{
 public static async Task Run()
 {
  var dir=Path.Combine(Path.GetTempPath(),"spire-backup-"+Guid.NewGuid());Directory.CreateDirectory(dir);
  try
  {
   var store=new NativeWorkspaceStore(Path.Combine(dir,"local"));var w=await NativeWorkspace.OpenAsync(store);
   await w.ImportMarkdownAsync([("Writing/A.md","---\nunknown: retained\n---\n# Writing\n")]);var file=w.State.VisibleFiles().Single();await w.AttachAsync(file,"Attachments/a.png",[1,2,3]);await w.CreateFolderAsync("Empty");
   var archive=Path.Combine(dir,"workspace.spirebackup");await w.ExportBackupAsync(archive);var saved=JsonSerializer.Serialize(w.State,SyncWorkspace.Json);
   await w.EditAsync(file with{Content="changed"});await w.RestoreBackupAsync(archive);
   if(JsonSerializer.Serialize(w.State,SyncWorkspace.Json)!=saved)throw new Exception("Backup lost exact outbox, writing, folders or attachment state.");
   w=await NativeWorkspace.OpenAsync(store);if(JsonSerializer.Serialize(w.State,SyncWorkspace.Json)!=saved)throw new Exception("Restore did not persist.");
   try{await w.ImportMarkdownAsync([("Writing/New.md","new"),("Writing/A.md","collision")]);throw new Exception("Collision accepted.");}catch(InvalidOperationException){}
   if(JsonSerializer.Serialize(w.State,SyncWorkspace.Json)!=saved)throw new Exception("Import was not atomic.");
   store.BeforeCommit=()=>throw new IOException("disk full");try{await w.RestoreBackupAsync(archive);throw new Exception("Expected failure.");}catch(IOException){}store.BeforeCommit=null;
   var foreign=SyncWorkspace.Empty.BindOwner("foreign");await WorkspaceArchive.ExportAsync(Path.Combine(dir,"foreign.zip"),foreign);
   var ownerStore=new NativeWorkspaceStore(Path.Combine(dir,"owned"));await ownerStore.SaveAsync(SyncWorkspace.Empty.BindOwner("owner"));var owned=await NativeWorkspace.OpenAsync(ownerStore);
   try{await owned.RestoreBackupAsync(Path.Combine(dir,"foreign.zip"));throw new Exception("Account mixing accepted.");}catch(InvalidOperationException){}
   File.WriteAllText(Path.Combine(dir,"invalid.zip"),"invalid");try{await w.RestoreBackupAsync(Path.Combine(dir,"invalid.zip"));throw new Exception("Corruption accepted.");}catch(InvalidDataException){}
   Console.WriteLine("PASS: full backup exact restart/outbox/assets/folders, atomic additive Markdown import collision, restore disk failure, corrupt archive and account isolation");
  }finally{Directory.Delete(dir,true);}
 }
}
