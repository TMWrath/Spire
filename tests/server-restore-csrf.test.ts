import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../client/sync.ts',import.meta.url),'utf8');
const body=source.split(' async restore(){')[1].split('\n async connect(')[0].replace(/},\s*$/,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const restored=transformSync('async function restore(){'+body+'}',{loader:'ts',target:'es2022'}).code;
for(const online of [true,false])test('restored Server registration waits for live CSRF; online='+online,async()=>{
 const events:string[]=[];let finish!:()=>void;
 const refreshed=new Promise<void>(resolve=>finish=resolve);
 class Engine{authRequired=false;cache={identity:{owner:'owner',device:{id:'device'},csrf:''}};
 async init(){events.push('cached-ready');}
 async sync(){events.push('refresh-start');await refreshed;if(online)this.cache.identity.csrf='fresh-session';events.push('refresh-end');}
 async request(path:string,_options:unknown,csrf:string){events.push('registration');assert.equal(path,'/device-installation');assert.equal(csrf,'fresh-session');}}
 const profile={kind:'server',origin:'https://server.example',account:'owner',workspace:'vault'};
 const store={getAllKeys:async()=>[],get:async(_store:string,key:string)=>key==='server-profile'?profile:undefined};
 const run=new AsyncFunction('db','Engine','scopeKey','installationIdentity','localEngine',restored+';return restore.call(this);');
 const context={supported:true,journals:[],remote:undefined};
 const flight=run.call(context,Promise.resolve(store),Engine,()=> 'scope',async()=>({id:'installation'}),{emit(){}});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(events.includes('cached-ready'),'cached UI stays available');
 assert.ok(!events.includes('registration'),'no registration before session refresh');
 finish();await flight;
 assert.equal(events.includes('registration'),online,'offline startup never posts an empty cached token');
});
