using Spire.Core;
using System.Text.Json;
// Hosted parity regression coverage for shared/quick-actions.ts quickActionInputSchema,
// server actionStem/saveQuickAction validation, and the quick action metadata contract.
static class QuickActionRulesTests
{
 static JsonElement Json(object value)=>JsonSerializer.SerializeToElement(value,SyncWorkspace.Json);
 static List<JsonElement> Templates(params (string id,string title)[] items)=>items.Select(i=>Json(new{id=i.id,title=i.title})).ToList();
 static void Throws<T>(Action action,string what) where T:Exception
 {
  try{action();}catch(T){return;}catch(Exception e){throw new Exception(what+" threw "+e.GetType().Name+": "+e.Message);}
  throw new Exception(what+" did not throw "+typeof(T).Name);
 }
 public static void Run()
 {
  // StylePath
  if(QuickActionRules.StylePath("Writing/A.md")!="Writing/A.css")throw new Exception("StylePath derivation");
  if(QuickActionRules.StylePath("Writing/A.MD")!="Writing/A.css")throw new Exception("StylePath case-insensitive .md");
  Throws<ArgumentException>(()=>QuickActionRules.StylePath("Writing/A.txt"),"StylePath must require .md");

  // Substitute/Stem hosted actionStem parity
  var now=new DateTime(2026,3,7,8,9,10);
  if(QuickActionRules.Substitute("Note {date} at {time}.md",now)!="Note 2026-03-07 at 08-09-10.md")throw new Exception("Substitute");
  if(QuickActionRules.Stem("Note {date} at {time}.md",now)!="Note 2026-03-07 at 08-09-10")throw new Exception("Stem must strip the .md suffix like hosted actionStem");
  if(QuickActionRules.Stem("Note {date}",now)!="Note 2026-03-07")throw new Exception("Stem without suffix");
  if(QuickActionRules.Stem("Note.MD",now)!="Note")throw new Exception("Stem strips a case-insensitive .MD suffix");

  // ValidateInput happy paths
  var full=NativeTemplates.FullIds.First();
  var saved=Templates(("t1","Saved one"),("t2","Saved two"));
  if(string.IsNullOrEmpty(full))throw new Exception("No built-in full templates");
  if(NativeTemplates.FullIds.Contains("header-hero")||NativeTemplates.FullIds.Contains("collapsible"))throw new Exception("Section templates must not be quick action choices");
  QuickActionRules.ValidateInput("Journal","Writing","Untitled {date}.md",null,saved);
  QuickActionRules.ValidateInput("Journal","Writing","Untitled {date}","saved-t1",saved);
  QuickActionRules.ValidateInput("Journal","Writing","Untitled {date}.md",full,saved);
  QuickActionRules.ValidateInput("  Journal  ","Writing","  Untitled {date}.md  ",null,saved);

  // ValidateInput rejections
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("","Writing","A.md",null,saved),"empty label");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput(new string('x',101),"Writing","A.md",null,saved),"oversized label");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","","A.md",null,saved),"empty folder");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","../Escaping","A.md",null,saved),"parent folder");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","",null,saved),"empty pattern");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing",new string('y',121),null,saved),"oversized pattern");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","a/b.md",null,saved),"pattern with slash");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","{date}a:b",null,saved),"unsafe substituted pattern");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing",".md",null,saved),"bare extension");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","A.md",new string('t',101),saved),"oversized template id");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","A.md","missing-template",saved),"unknown template id");
  Throws<ArgumentException>(()=>QuickActionRules.ValidateInput("Journal","Writing","A.md","saved-missing",saved),"missing saved template");

  // TemplateAvailable
  if(!QuickActionRules.TemplateAvailable(full,saved)||!QuickActionRules.TemplateAvailable("saved-t1",saved))throw new Exception("TemplateAvailable must accept full and saved templates");
  if(QuickActionRules.TemplateAvailable("saved-missing",saved)||QuickActionRules.TemplateAvailable("does-not-exist",saved)||QuickActionRules.TemplateAvailable("header-hero",saved))throw new Exception("TemplateAvailable must reject unavailable ids");

  // Normalize
  var original=Json(new{id="qa-1",label=" Journal ",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null,revision=1,created="2026-01-01T00:00:00Z",customFlag="keep"});
  var changed=Json(new{id="qa-1",label="Renamed",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null,customFlag="keep"});
  var normalized=QuickActionRules.Normalize(changed,original,saved);
  if(normalized.GetProperty("label").GetString()!="Renamed")throw new Exception("Normalize label");
  if(normalized.GetProperty("customFlag").GetString()!="keep")throw new Exception("Normalize must preserve unknown fields");
  if(normalized.GetProperty("templateId").ValueKind!=JsonValueKind.Null)throw new Exception("Normalize must keep a null templateId");
  if(normalized.GetProperty("revision").GetInt32()!=1)throw new Exception("Normalize revision");
  if(normalized.GetProperty("created").GetString()!="2026-01-01T00:00:00Z")throw new Exception("Normalize must preserve read-only created");
  var trimmed=QuickActionRules.Normalize(Json(new{id="qa-1",label="  Trimmed  ",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null,customFlag="keep"}),original,saved);
  if(trimmed.GetProperty("label").GetString()!="Trimmed")throw new Exception("Normalize must trim the label");
  var switched=QuickActionRules.Normalize(Json(new{id="qa-1",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId="saved-t2",customFlag="keep"}),original,saved);
  if(switched.GetProperty("templateId").GetString()!="saved-t2")throw new Exception("Normalize template switch");
  Throws<ArgumentException>(()=>QuickActionRules.Normalize(Json(new{id="qa-1",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null,customFlag="changed"}),original,saved),"unknown field change");
  Throws<ArgumentException>(()=>QuickActionRules.Normalize(Json(new{id="qa-2",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null}),original,saved),"identity mismatch");
  Throws<ArgumentException>(()=>QuickActionRules.Normalize(changed,Json(new{id="qa-1",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null}),saved),"missing revision");
  Throws<ArgumentException>(()=>QuickActionRules.Normalize(changed,Json(new{id="qa-1",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId=(string?)null,revision=0}),saved),"invalid revision");
  Throws<ArgumentException>(()=>QuickActionRules.Normalize(Json(new{id="qa-1",label="Journal",folder="Writing",namePattern="Note {date}.md",templateId="saved-missing"}),original,saved),"unavailable template after normalize");

  // OrderPayload request contract
  var payload=QuickActionRules.OrderPayload(new(Guid.NewGuid(),["b-id","a-id"],["a-id","b-id"]));
  if(!payload.GetProperty("ids").EnumerateArray().Select(v=>v.GetString()).SequenceEqual(["b-id","a-id"])||!payload.GetProperty("expected").EnumerateArray().Select(v=>v.GetString()).SequenceEqual(["a-id","b-id"]))throw new Exception("OrderPayload shape");

  Console.WriteLine("PASS: quick action input validation, hosted actionStem parity, full/saved template availability, normalization with unknown-field preservation, order payload contract");
 }
}
