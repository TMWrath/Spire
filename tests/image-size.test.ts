import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resizeImageSource,deleteImageSource,layoutImageSource} from '../client/image-size';
test('resize a Markdown image without rewriting surrounding prose, code or sibling images',()=>{
 const source='```md\n![A](one.png)\n```\n\nBefore ![A](one.png "Caption") after.\n\n![B](two.png)';
 assert.equal(resizeImageSource(source,0,50),'```md\n![A](one.png)\n```\n\nBefore <img src="one.png" alt="A" title="Caption" style="width:50%;height:auto"> after.\n\n![B](two.png)');
});
test('resize HTML without losing alignment and other attributes',()=>{
 assert.equal(resizeImageSource('<div align="right"><img src="x.png" alt="A" style="border:1px solid red;width:20%" width="20"></div>',0,75),'<div align="right"><img src="x.png" alt="A" style="border:1px solid red;width:75%;height:auto"></div>');
});
test('wiki image keeps its relative attachment link',()=>assert.equal(resizeImageSource('![[../Assets/a.png|Photo]]',0,25),'<img src="../Assets/a.png" alt="Photo" style="width:25%;height:auto">'));
test('invalid percentages and absent images do not change source',()=>{for(const value of [0,101,NaN,Infinity])assert.equal(resizeImageSource('![A](x)',0,value),'![A](x)');assert.equal(resizeImageSource('text',0,50),'text');});

test("delete only the selected source image",()=>{const s="Before ![A](a.png) middle ![B](b.png) after";assert.equal(deleteImageSource(s,0),"Before  middle ![B](b.png) after");assert.equal(deleteImageSource(s,5),s);});

test('image layouts preserve sizes, siblings, source and unrelated styles',()=>{
 const source='Before <img src="a.png" alt="A" style="width:40%;border:1px solid red"> after ![B](b.png)';
 for(const layout of ['inline','block-left','block-center','block-right','wrap-left','wrap-right'] as const){const result=layoutImageSource(source,0,layout);assert.match(result,/width:40%;border:1px solid red/);assert.ok(result.includes('data-image-layout="'+layout+'"'));assert.ok(result.endsWith(' after ![B](b.png)'));assert.equal(layoutImageSource(result,0,layout),result);}
 assert.equal(layoutImageSource('```html\n<img src="a">\n```',0,'wrap-left'),'```html\n<img src="a">\n```');
});
