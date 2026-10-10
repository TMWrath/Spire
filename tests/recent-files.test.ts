import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRecent,rememberRecent,recentFiles} from '../client/recent-files';
import type {Note} from '../shared/model';
test('recent files are owner-scoped, deduplicated, rename-safe and exclude trash',()=>{const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});rememberRecent('a','1');rememberRecent('a','2');rememberRecent('a','1');assert.deepEqual(readRecent('a'),['1','2']);assert.deepEqual(readRecent('b'),[]);const n=(id:string,path:string,deleted=false)=>({id,path,deleted} as Note);assert.deepEqual(recentFiles(['1','2','1','missing'],[n('1','Renamed/File.md'),n('2','Trash.md',true)]).map(n=>n.path),['Renamed/File.md']);values.set('spire-recent-files:a','broken');assert.deepEqual(readRecent('a'),[]);});
