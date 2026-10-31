namespace Spire.Core;

public sealed class WritingSession(NativeWorkspace workspace)
{
 readonly SemaphoreSlim gate=new(1,1);
 public Guid? CurrentId {get;private set;}
 public string Path {get;private set;}="";
 public string Content {get;private set;}="";
 public void Update(string path,string content){Path=path;Content=content;}
 async Task SaveCore()
 {
  if(CurrentId is not Guid id)return;
  var file=workspace.State.VisibleFiles().Single(f=>f.Id==id);
  await workspace.EditAsync(file with{Path=Path,Content=Content});
  var saved=workspace.State.VisibleFiles().Single(f=>f.Id==id);Path=saved.Path;Content=saved.Content;
 }
 public async Task SaveAsync(){await gate.WaitAsync();try{await SaveCore();}finally{gate.Release();}}
 public async Task OpenAsync(Guid? id)
 {
  await gate.WaitAsync();try
  {
   await SaveCore();
   var next=id is null?null:workspace.State.VisibleFiles().Single(f=>f.Id==id);
   CurrentId=next?.Id;Path=next?.Path??"";Content=next?.Content??"";
  }finally{gate.Release();}
 }
 public void ReloadSaved()
 {
  var next=workspace.State.VisibleFiles().FirstOrDefault(f=>f.Id==CurrentId);
  CurrentId=next?.Id;Path=next?.Path??"";Content=next?.Content??"";
 }
}

public sealed record NavigationNode(string Label,string Path,Guid? FileId,IReadOnlyList<NavigationNode> Children);
public static class WorkspaceNavigation
{
 public static IReadOnlyList<NavigationNode> Build(IEnumerable<ServerFile> source,IEnumerable<string> explicitFolders,string query,bool trash)
 {
  var files=source.Where(f=>f.Deleted==trash&&(f.Path+"\n"+f.Content).Contains(query,StringComparison.OrdinalIgnoreCase)).OrderBy(f=>f.Path,StringComparer.OrdinalIgnoreCase).ToArray();
  var folders=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var path in files.Select(f=>f.Path[..f.Path.LastIndexOf('/')]).Concat(string.IsNullOrEmpty(query)&&!trash?explicitFolders:[]))
  {
   var segments=path.Split('/');for(int i=1;i<=segments.Length;i++)folders.Add(string.Join('/',segments.Take(i)));
  }
  IReadOnlyList<NavigationNode> At(string parent)=>folders.Where(p=>Parent(p)==parent).OrderBy(p=>p,StringComparer.OrdinalIgnoreCase).Select(p=>new NavigationNode(p.Split('/')[^1],p,null,At(p))).Concat(files.Where(f=>Parent(f.Path)==parent).Select(f=>new NavigationNode(f.Path.Split('/')[^1],f.Path,f.Id,[]))).ToArray();
  return At("");
 }
 static string Parent(string p)=>p.Contains('/')?p[..p.LastIndexOf('/')]:"";
}
