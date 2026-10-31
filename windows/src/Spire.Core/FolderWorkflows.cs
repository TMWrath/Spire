using System.Text.RegularExpressions;
namespace Spire.Core;
public sealed partial class NativeWorkspace
{
 public async Task TrashFolderAsync(string path)
 {
  await gate.WaitAsync();try
  {
   LocalFiles.ValidatePortablePath(path);
   if(!State.Folders().Contains(path))throw new ArgumentException("Folder not found.");
   GuardFolderAssets(path);
   var next=State;
   foreach(var f in State.VisibleFiles().Where(f=>!f.Deleted&&Inside(f.Path,path)))next=next.Queue(f with{Deleted=true});
   foreach(var p in next.Folders().Where(p=>p==path||Inside(p,path)).OrderByDescending(p=>p.Length).ToArray())next=next.QueueFolder(p,true);
   await Commit(next);
  }finally{gate.Release();}
 }
 public async Task MoveFolderAsync(string path,string destination)
 {
  await gate.WaitAsync();try
  {
   LocalFiles.ValidatePortablePath(path);LocalFiles.ValidatePortablePath(destination);
   if(string.Equals(path,destination,StringComparison.OrdinalIgnoreCase)||Inside(destination,path))throw new ArgumentException("Cannot move a folder into itself.");
   if(!State.Folders().Contains(path))throw new ArgumentException("Folder not found.");
   GuardFolderAssets(path);
   if(State.Folders().Any(p=>string.Equals(p,destination,StringComparison.OrdinalIgnoreCase)||Inside(p,destination)))throw new ArgumentException("Destination is occupied.");
   var files=State.VisibleFiles().Where(f=>!f.Deleted).ToArray();
   string Map(string p)=>Inside(p,path)?destination+p[path.Length..]:p;
   var mapped=files.Select(f=>Map(f.Path)).ToArray();
   if(mapped.Distinct(StringComparer.OrdinalIgnoreCase).Count()!=mapped.Length)throw new ArgumentException("Destination file collision.");
   foreach(var p in mapped)if(mapped.Any(q=>!string.Equals(p,q,StringComparison.OrdinalIgnoreCase)&&Inside(p,q)))throw new ArgumentException("Destination file/folder collision.");
   var next=State;
   var oldFolders=State.Folders().Where(p=>p==path||Inside(p,path)).ToArray();
   foreach(var p in oldFolders.OrderBy(p=>p.Length))next=next.QueueFolder(p==path?destination:Map(p),false);
   foreach(var f in files)
   {
    var newPath=Map(f.Path);var content=RebaseFolderLinks(f.Content,f.Path,newPath,files,Map);
    if(newPath!=f.Path)content=PortableCitations.Rebase(content,newPath);
    if(content!=f.Content||newPath!=f.Path)next=next.Queue(f with{Path=newPath,Content=content});
   }
   foreach(var p in oldFolders.OrderByDescending(p=>p.Length))next=next.QueueFolder(p,true);
   await Commit(next);
  }finally{gate.Release();}
 }
 static bool Inside(string p,string folder)=>p.StartsWith(folder+"/",StringComparison.OrdinalIgnoreCase);
 void GuardFolderAssets(string path)
 {
  var snapshot=State.Snapshot;
  var attachments=snapshot is not null&&snapshot.Value.TryGetProperty("attachments",out var a)?a.EnumerateArray().Select(x=>x.GetProperty("path").GetString()!):[];
  var styles=snapshot is not null&&snapshot.Value.TryGetProperty("styles",out var s)?s.EnumerateObject().Select(x=>x.Name):[];
  if(State.Assets.Keys.Concat(attachments).Concat(styles).Any(p=>Inside(p,path)))throw new InvalidOperationException("Move or delete attached assets/styles separately before this folder operation.");
  if(State.Conflicts.Count>0||State.FolderConflicts.Count>0)throw new InvalidOperationException("Resolve workspace conflicts before folder operations.");
 }
 static string RebaseFolderLinks(string content,string oldPath,string newPath,ServerFile[] files,Func<string,string> map)
 {
  // Protected source regions stay byte-for-byte intact. Unknown link forms remain untouched.
  var protectedRanges=Regex.Matches(content,@"(?ms)^\s*(`{3,}|~{3,})[^\r\n]*\r?\n.*?^\s*\1[^\r\n]*|<!--.*?-->|`[^`\r\n]*`").Cast<Match>().ToArray();
  bool Protected(int index)=>protectedRanges.Any(m=>index>=m.Index&&index<m.Index+m.Length);
  string Relative(string target)=>Path.GetRelativePath("/"+(Path.GetDirectoryName(newPath)?.Replace('\\','/')??""),"/"+map(target)).Replace('\\','/');
  string Resolve(string target)=>Path.GetFullPath(target,"/"+(Path.GetDirectoryName(oldPath)?.Replace('\\','/')??"")).TrimStart('/').Replace('\\','/');
  var pattern=@"\[\[(?<wiki>[^\]\r\n]+)\]\]|\]\((?<link>[^\s)]+)\)|\bsrc=""(?<src>[^""\r\n]+)""";
  return Regex.Replace(content,pattern,m=>
  {
   if(Protected(m.Index))return m.Value;
   if(m.Groups["wiki"].Success)
   {
    var parts=m.Groups["wiki"].Value.Split('|',2);var target=parts[0];var hash=target.IndexOf('#');var anchor=hash>=0?target[hash..]:"";if(hash>=0)target=target[..hash];
    var candidates=files.Where(f=>f.Path==target||f.Path==target+".md"||f.Path==Resolve(target)||f.Path==Resolve(target+".md")||Path.GetFileNameWithoutExtension(f.Path)==target).ToArray();
    if(candidates.Length!=1)return m.Value;
    var resolved=map(candidates[0].Path);if(oldPath==newPath&&resolved==candidates[0].Path)return m.Value;
    return "[["+(resolved.EndsWith(".md")?resolved[..^3]:resolved)+anchor+(parts.Length==2?"|"+parts[1]:"")+"]]";
   }
   var group=m.Groups["link"].Success?m.Groups["link"]:m.Groups["src"];var value=group.Value;
   if(value.StartsWith('/')||value.StartsWith('#')||Regex.IsMatch(value,@"^[a-zA-Z][a-zA-Z0-9+.-]*:"))return m.Value;
   var split=value.IndexOfAny(['#','?']);var suffix=split>=0?value[split..]:"";var targetPath=Resolve(split>=0?value[..split]:value);
   var replacement=Relative(targetPath)+suffix;
   return m.Value[..(group.Index-m.Index)]+replacement+m.Value[(group.Index-m.Index+group.Length)..];
  });
 }
}
