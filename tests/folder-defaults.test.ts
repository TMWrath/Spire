import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {LazyFolder} from '../client/LazyFolder';

// Execute the actual recursive JSX renderers with an isolated empty workspace.
for(const [file,start,end] of [
 ['client/main.tsx','const renderFolder=',';\n const unattached=']
] as const){
 test(`${file}: all folder levels start collapsed`,()=>{
  const source=fs.readFileSync(file,'utf8');
  const expression=source.slice(source.indexOf(start)+start.length,source.indexOf(end,source.indexOf(start)));
  const name=start.slice('const '.length,-1);
  const code=transformSync(`const ${name}=${expression}; const render=${name};`,{loader:'tsx',jsx:'transform',format:'cjs'}).code;
  const noop=()=>{};const icon=()=>React.createElement('i');
  const bindings={ItemIcon:icon,ItemName:({children}:{children:React.ReactNode})=>React.createElement('span',null,children),Trash2:icon,query:'',React,LazyFolder,Folder:icon,FileText:icon,ArrowRightLeft:icon,Star:icon,drag:null,selectedFolder:null,selected:null,trash:false,filtered:[],files:[],folders:['Parent','Parent/Child'],dirs:['Parent','Parent/Child'],mounted:{supported:false},engine:{cache:{outbox:[]}},mount:{remote:false},dragRef:{current:null},beginItemDrag:noop,continueItemDrag:noop,finishItemDrag:noop,onDragStart:noop,onDragMove:noop,onDragEnd:noop,startFolderPress:noop,stopFolderPress:noop,beginFolderDelete:noop,setSelectedFolder:noop,folderLongPressed:{current:false},requestMove:noop,onMove:noop,onOpen:noop,open:noop,isStarred:()=>false};
  const render=new Function(...Object.keys(bindings),code+'return render;')(...Object.values(bindings));
  const html=renderToStaticMarkup(render('Parent'));
  assert.equal((html.match(/<details\b/g)??[]).length,1,'closed parent defers nested child construction');
  assert.doesNotMatch(html,/<details[^>]*\bopen(?:=|\s|>)/,'folder tree must not force expanded defaults');
  assert.match(html,/<summary/,'native disclosure toggle remains available');
 });
}
