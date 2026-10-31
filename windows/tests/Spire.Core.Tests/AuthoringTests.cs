using Spire.Core;
using System.Text.Json;
static class AuthoringTests
{
 static void Check(bool ok,string why){if(!ok)throw new Exception(why);}
 public static async Task Run()
 {
  var root=Path.Combine(Path.GetTempPath(),"spire-authoring-"+Guid.NewGuid());
  try
  {
   var store=new NativeWorkspaceStore(root);var engine=await NativeWorkspace.OpenAsync(store);
   var a=new ServerFile(Guid.NewGuid(),0,"Writing/A.md","A",false,"",JsonSerializer.SerializeToElement(Array.Empty<object>()));
   var b=a with{Id=Guid.NewGuid(),Path="Writing/Sub/B.md",Content="B"};
   await engine.EditAsync(a);await engine.EditAsync(b);
   var session=new WritingSession(engine);await session.OpenAsync(a.Id);session.Update("Writing/A.md","unsaved");
   store.BeforeCommit=()=>throw new IOException("disk unavailable");
   try{await session.OpenAsync(b.Id);throw new Exception("Expected failed save");}catch(IOException){}
   Check(session.CurrentId==a.Id&&session.Content=="unsaved","Navigation lost draft on save failure");
   store.BeforeCommit=null;await session.OpenAsync(b.Id);
   Check(engine.State.VisibleFiles().Single(f=>f.Id==a.Id).Content=="unsaved"&&session.Content=="B","Save-before-navigation failed");
   var tree=WorkspaceNavigation.Build(engine.State.VisibleFiles(),new[]{"Empty/Nested"},"unsaved",false);
   Check(tree.Single().Path=="Writing"&&tree.Single().Children.Single().FileId==a.Id,"Hierarchy search lost ancestor or file");
   var preview=new LocalFile(Guid.NewGuid(),"Preview/Draft.md","original preview");
   var beforeAdoption=engine.State;
   Check(!engine.State.VisibleFiles().Any(f=>f.Id==preview.Id),"Preview must not be adopted implicitly");
   await engine.AdoptPreviewAsync(new[]{preview});await engine.AdoptPreviewAsync(new[]{preview});
   Check(engine.State.VisibleFiles().Count(f=>f.Id==preview.Id)==1,"Repeated adoption duplicates preview");
   var adopted=engine.State;
   bool collision=false;try{await engine.AdoptPreviewAsync(new[]{new LocalFile(Guid.NewGuid(),"Preview/Draft.md/Child.md","collision")});}catch(InvalidOperationException){collision=true;}
   Check(collision&&engine.State==adopted,"Adoption accepts a file as a folder or changes state on failure");
   store.BeforeCommit=()=>throw new IOException("disk unavailable");
   bool failedAdoption=false;try{await engine.AdoptPreviewAsync(new[]{new LocalFile(Guid.NewGuid(),"Preview/Other.md","draft")});}catch(IOException){failedAdoption=true;}
   Check(failedAdoption&&engine.State==adopted,"Adoption failure modified memory");store.BeforeCommit=null;
   var provenance=engine.State.VisibleFiles().Single(f=>f.Id==b.Id) with{TemplateIds=new[]{"saved-example"}};
   await engine.EditAsync(provenance);engine=await NativeWorkspace.OpenAsync(new NativeWorkspaceStore(root));
   Check(engine.State.VisibleFiles().Single(f=>f.Id==b.Id).TemplateIds!.Single()=="saved-example","Template provenance not durable");
   var citationId=Guid.NewGuid();var citation="[Book](../../Sources/"+citationId+".md)";var cited=engine.State.VisibleFiles().Single(f=>f.Id==b.Id) with{Content=citation};await engine.EditAsync(cited);
   await engine.EditAsync(cited with{Path="Writing/Moved.md"});
   Check(engine.State.VisibleFiles().Single(f=>f.Id==b.Id).Content==citation.Replace("../../Sources/","../Sources/"),"Offline rename did not rebase citations");
   var movedSession=new WritingSession(engine);await movedSession.OpenAsync(b.Id);movedSession.Update("Writing/Deep/Moved.md",movedSession.Content);await movedSession.SaveAsync();
   Check(movedSession.Content.Contains("../../Sources/",StringComparison.Ordinal)&&engine.State.VisibleFiles().Single(f=>f.Id==b.Id).Content==movedSession.Content,"Saved session retained stale citation offsets after move");
   var range=new SourceRange("hello 🌞 world",6,2);
   var result=PortableAuthoring.Wrap(range,"**","**");
   Check(result.Content=="hello **🌞** world"&&result.Start==8&&result.Length==2,"Selection replacement UTF16 contract");
   Check(PortableAuthoring.Block("code","```\ntext","cs").StartsWith("````cs\n```"),"Unsafe code fence");
   Check(PortableAuthoring.Block("quote","a\n\nb")=="> a\n>\n> b","Quote blank-line portability");
   var heading=PortableAuthoring.Heading(new("## Old\nrest",3,3),1);
   Check(heading.Content=="# Old\nrest","Heading stacked markers");
   var table=PortableAuthoring.Table("id",new[]{new[]{"A|B","C"},new[]{"one\ntwo","x"}},new[]{"center","right"});
   Check(table.Contains("A\\|B")&&table.Contains(":---: | ---:")&&table.Contains("one<br>two"),"Table escaping/alignment");
   var dictionary=PortableAuthoring.Dictionary("Terms");
   dictionary=PortableAuthoring.AppendDefinition(dictionary,"Sun","A star.");
   bool duplicate=false;try{PortableAuthoring.AppendDefinition(dictionary,"Sun","again");}catch(ArgumentException){duplicate=true;}Check(duplicate,"Duplicate definition accepted");
   Console.WriteLine("PASS: transactional save-before-navigation; hierarchy search; selection-safe Unicode authoring; heading reset, safe fences, quote lines, portable managed tables, duplicate-safe dictionary entries");
  }finally{Directory.Delete(root,true);}
 }
}
