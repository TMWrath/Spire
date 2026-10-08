import {parseDocument,isMap} from 'yaml';
export const pageBreak='<div style="break-after: page;"></div>';
export type Section={enabled:boolean;text:string};
export type PageLayout={header:Section;footer:Section;footnotes?:Section;body:string};
const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const begin=(part:string)=>`<!-- spire:${part} -->\n`;
const end=(part:string)=>`\n<!-- /spire:${part} -->`;
export function readPage(content:string):PageLayout{
 const m=front.exec(content),doc=parseDocument(m?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML before editing page sections.');
 const config=(doc.toJSON() as Record<string,unknown>|null)?.spire_page as Record<string,unknown>|undefined;
 const section=(key:string):Section=>{const x=config?.[key] as Partial<Section>|undefined;return {enabled:x?.enabled===true,text:typeof x?.text==='string'?x.text:''};};
 const header=section('header'),footer=section('footer'),footnotes=section('footnotes');let body=m?content.slice(m[0].length):content;
 if(footnotes.enabled&&(body.includes(begin('footnotes'))!==body.endsWith(end('footnotes'))))throw new Error('Footnotes boundary is incomplete. Restore its comments in Source.');
 if(footnotes.enabled&&body.endsWith(end('footnotes'))){const at=body.lastIndexOf(begin('footnotes'));if(at<0)throw new Error('Footnotes boundary is incomplete. Restore its opening comment in Source.');footnotes.text=body.slice(at+begin('footnotes').length,-end('footnotes').length);body=body.slice(0,at);if(body.endsWith('\n\n'))body=body.slice(0,-2);}
 if(header.enabled&&body.startsWith(begin('header'))){const at=body.indexOf(end('header'),begin('header').length);if(at<0)throw new Error('Header boundary is incomplete. Restore its closing comment in Source.');header.text=body.slice(begin('header').length,at);body=body.slice(at+end('header').length);if(body.startsWith('\n\n'))body=body.slice(2);}
 else if(header.enabled&&header.text){const h=header.text+'\n\n';if(!body.startsWith(h))throw new Error('Page section boundaries changed in Source. Restore their text or remove spire_page frontmatter to use this file as a normal document.');body=body.slice(h.length);}
 if(footer.enabled&&body.endsWith(end('footer'))){const at=body.lastIndexOf(begin('footer'));if(at<0)throw new Error('Footer boundary is incomplete. Restore its opening comment in Source.');footer.text=body.slice(at+begin('footer').length,-end('footer').length);body=body.slice(0,at);if(body.endsWith('\n\n'))body=body.slice(0,-2);}
 else if(footer.enabled&&footer.text){const f='\n\n'+footer.text;if(!body.endsWith(f))throw new Error('Page section boundaries changed in Source. Restore their text or remove spire_page frontmatter to use this file as a normal document.');body=body.slice(0,-f.length);}
 return {header,footer,footnotes,body};
}
export function writePage(content:string,layout:PageLayout):string{
 const m=front.exec(content),doc=parseDocument(m?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML before editing page sections.');
 for(const part of ['header','footer','footnotes'] as const)if(/<!--\s*\/?spire:(header|footer|footnotes)\s*-->/.test(layout[part]?.text??''))throw new Error('Section boundary comments cannot be nested inside a header or footer.');
 const footnotes=layout.footnotes??{enabled:false,text:''};
 doc.set('spire_page',{header:layout.header,footer:layout.footer,footnotes});
 const h=layout.header.enabled?begin('header')+layout.header.text+end('header')+'\n\n':'';
 const f=layout.footer.enabled?'\n\n'+begin('footer')+layout.footer.text+end('footer'):'';
 return `---\n${doc.toString()}---\n${h}${layout.body}${f}${footnotes.enabled?'\n\n'+begin('footnotes')+footnotes.text+end('footnotes'):''}`;
}
export function hasPage(content:string){return /^spire_page:/m.test(front.exec(content)?.[1]??'');}
