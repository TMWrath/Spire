using Spire.Core;
static class BuiltinTemplateTests
{
 public static void Run()
 {
  var all=NativeTemplates.For("", "Writing/A.md");if(all.Count!=5||all.Select(t=>t.Id).Distinct().Count()!=5)throw new Exception("Built-in template inventory differs");
  if(all.Single(t=>t.Id=="checklist").Content!="# Checklist\n\n## Details\n\n- Goal: \n- Due date: \n\n## Priority\n\n- [ ] First priority\n- [ ] Second priority\n\n## Tasks\n\n- [ ] First task\n- [ ] Second task\n- [ ] Third task\n\n## Follow-up\n\n- [ ] Review progress\n\n## Additional details\n\nAdd supporting information here.\n")throw new Exception("Checklist differs from hosted source");
  var original="---\r\nhero: Attachments/heroes/test.png\r\ndescription: Two lines\r\ntags: [one, two]\r\nfuture: retained\r\n---\r\nbody";
  var hero=NativeTemplates.For(original,"Writing/Sub/A.md").Single(t=>t.Id=="header-hero").Content;
  if(!hero.Contains("../../Attachments/heroes/test.png")||!hero.Contains("> Two lines")||!hero.Contains("#one #two"))throw new Exception("Header properties not projected safely");
  var unsafeHero=NativeTemplates.For("---\nhero: https://remote.invalid/image.png\n---\ntext","Writing/A.md").Single(t=>t.Id=="header-hero");if(unsafeHero.Content.Contains("remote.invalid"))throw new Exception("Unsafe header URL adopted");
  var result=NativeTemplates.Insert(original,0,"# Inserted\n");if(!result.Content.StartsWith(original[..original.IndexOf("body")],StringComparison.Ordinal)||!result.Content.EndsWith("body")||!result.Content.Contains("# Inserted"))throw new Exception("Insertion entered YAML or lost suffix");
  if(NativeTemplates.Insert("prefixsuffix",6,"# Inserted\n").Content!="prefix\n\n# Inserted\n\nsuffix")throw new Exception("Hosted template spacing differs");
  if(NativeTemplates.Insert("","".Length,"# Inserted\n").Content!="# Inserted\n")throw new Exception("Empty template insertion differs");
  Console.WriteLine("PASS: five built-in templates, source-exact checklist, dynamic safe hero/description/tags, insertion outside CRLF/YAML, suffix retention and hosted blank-line rules");
 }
}
