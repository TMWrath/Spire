import {parseDocument,isMap} from 'yaml';
export const pageBreak='<div style="break-after: page;"></div>';
export type Section={enabled:boolean;text:string};
export type PageLayout={header:Section;footer:Section;body:string};
const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
export function readPage(content:string):PageLayout{
 const m=front.exec(content),doc=parseDocument(m?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML before editing page sections.');
 const config=(doc.toJSON() as Record<string,unknown>|null)?.spire_page as Record<string,unknown>|undefined;
 const section=(key:string):Section=>{const x=config?.[key] as Partial<Section>|undefined;return {enabled:x?.enabled===true,text:typeof x?.text==='string'?x.text:''};};
 const header=section('header'),footer=section('footer');let body=m?content.slice(m[0].length):content;
 const h=header.enabled&&header.text?header.text+'\n\n':'';const f=footer.enabled&&footer.text?'\n\n'+footer.text:'';
 if(h&&!body.startsWith(h)||f&&!body.endsWith(f)||h.length+f.length>body.length)throw new Error('Page section boundaries changed in Source. Restore their text or remove spire_page frontmatter to use this file as a normal document.');
 body=body.slice(h.length,body.length-f.length);
 return {header,footer,body};
}
export function writePage(content:string,layout:PageLayout):string{
 const m=front.exec(content),doc=parseDocument(m?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML before editing page sections.');
 doc.set('spire_page',{header:layout.header,footer:layout.footer});
 const h=layout.header.enabled&&layout.header.text?layout.header.text+'\n\n':'';
 const f=layout.footer.enabled&&layout.footer.text?'\n\n'+layout.footer.text:'';
 return `---\n${doc.toString()}---\n${h}${layout.body}${f}`;
}
export function hasPage(content:string){return /^spire_page:/m.test(front.exec(content)?.[1]??'');}
