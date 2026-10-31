// Native DirectFolderOperations consumes a file write-set, not a replacement
// workspace. Retain directory context for parent/collision checks; keep full
// snapshots inside the runtime for acknowledgement and failure recovery.
export function compactCommit(before, after) {
 const previous = {}, next = {};
 const equal = (a,b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object' &&
  a.kind === b.kind && a.id === b.id && a.size === b.size && a.modified === b.modified);
 for (const path of new Set([...Object.keys(before.files), ...Object.keys(after.files)])) {
  if (equal(before.files[path], after.files[path])) continue;
  if (Object.hasOwn(before.files,path)) previous[path] = before.files[path];
  if (Object.hasOwn(after.files,path)) next[path] = after.files[path];
 }
 const beforeDirs=new Set(before.dirs),afterDirs=new Set(after.dirs),context=new Set();
 for(const path of new Set([...Object.keys(previous),...Object.keys(next)])){
  const parts=path.split('/');parts.pop();
  while(parts.length){context.add(parts.join('/'));parts.pop();}
 }
 // Include only changed directories plus affected parents. The parent context keeps
 // native stale/collision checks intact without shipping unrelated folder arrays.
 return {before:{files:previous,dirs:before.dirs.filter(p=>!afterDirs.has(p)||context.has(p))},after:{files:next,dirs:after.dirs.filter(p=>!beforeDirs.has(p)||context.has(p))}};
}
