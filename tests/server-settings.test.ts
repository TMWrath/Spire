import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
function settings(supported:boolean,android:boolean,desktop:boolean,connected=false){
 const source=fs.readFileSync('client/WorkspaceMounts.tsx','utf8').split('export function ServerSettings')[1];
 const code=transformSync('function ServerSettings'+source,{loader:'tsx',jsx:'transform',format:'cjs'}).code;
 const bindings={React,useState:React.useState,mounted:{supported,remote:connected?{scope:{origin:"https://example.test"},cache:{identity:{username:"test"}},status:"Synchronized"}:undefined,journals:[],busy:false},androidAppAvailable:()=>android,window:{SpireApp:android?{postMessage:()=>{}}:undefined,spireWorkspaceLauncher:desktop?{open:()=>{}}:undefined}};
 const Component=new Function(...Object.keys(bindings),code+'return ServerSettings;')(...Object.values(bindings));
 return renderToStaticMarkup(React.createElement(Component,{beforeChange:async()=>{},onDisconnected:()=>{},onError:()=>{}}));
}
test('Storage tab contains the Local recovery export and Server settings without separate tabs',()=>{const source=fs.readFileSync('client/main.tsx','utf8');assert.match(source,/\['storage','Storage'\]/);assert.doesNotMatch(source,/\['server','Server connection'\]/);assert.match(source,/<LocalRecoveryPanel\/>/);assert.match(source,/<ServerSettings beforeChange=/);assert.match(source,/id="settings-storage"[\s\S]*?Local storage[\s\S]*?Server storage[\s\S]*?Backup export[\s\S]*?Imports/);assert.doesNotMatch(source,/\{settingsTab==='server'\?/);});
test('Local native transport retains the authenticated server form',()=>{assert.match(settings(true,false,false),/Server address/);assert.match(settings(true,false,false),/Connect server/);});
test('Android hosted mode retains native connection action without mounted transport',()=>{assert.match(settings(false,true,false),/Change server connection/);});
test('Windows hosted mode retains workspace launcher without mounted transport',()=>{assert.match(settings(false,false,true),/Connect to a server/);});

test('connected server hides credentials and offers explicit change and sign-out',()=>{const html=settings(true,false,false,true);assert.doesNotMatch(html,/<form|name="password"|name="username"|name="origin"/);assert.match(html,/Change connection/);assert.match(html,/Sign out of Server/);});
