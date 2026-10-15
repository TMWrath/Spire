import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LazyFolder} from '../client/LazyFolder';

test('closed folders do not construct files or recursively build descendants',()=>{
 let builds=0;
 const html=renderToStaticMarkup(React.createElement(LazyFolder,{summary:React.createElement('summary',null,'Writing'),children:()=>{builds++;return React.createElement('button',null,'Hidden manuscript');}}));
 assert.equal(builds,0);
 assert.match(html,/Writing/);
 assert.doesNotMatch(html,/Hidden manuscript/);
});

test('open folders construct their contents once and retain summary',()=>{
 let builds=0;
 const html=renderToStaticMarkup(React.createElement(LazyFolder,{defaultOpen:true,summary:React.createElement('summary',null,'Writing'),children:()=>{builds++;return React.createElement('button',null,'Manuscript');}}));
 assert.equal(builds,1);
 assert.match(html,/Manuscript/);
 assert.match(html,/<details open/);
});
