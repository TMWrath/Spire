namespace Spire.Core;
public sealed partial class NativeWorkspace
{
 public async Task CreateFolderAsync(string path)
 {await gate.WaitAsync();try{await Commit(State.QueueFolder(path,false));}finally{gate.Release();}}
 public async Task DeleteEmptyFolderAsync(string path)
 {await gate.WaitAsync();try{await Commit(State.QueueFolder(path,true));}finally{gate.Release();}}
 public async Task ResolveFolderAsync(Guid id,bool retry)
 {await gate.WaitAsync();try{await Commit(State.ResolveFolder(id,retry));}finally{gate.Release();}}
}
