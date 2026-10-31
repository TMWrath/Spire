import {metadata} from './model';

const start='<!-- spire:hero-section:start -->';
const end='<!-- spire:hero-section:end -->';
const sectionPattern=/<!-- spire:hero-section:start -->[\s\S]*?<!-- spire:hero-section:end -->/;

export function heroSectionMarkdown(content:string,path:string):string{
 const {properties}=metadata(content);
 const tags=Array.isArray(properties.tags)?properties.tags.filter((tag):tag is string=>typeof tag==='string'):typeof properties.tags==='string'?[properties.tags]:[];
 const hero=typeof properties.hero==='string'&&/^Attachments\/heroes\/[\w.-]+\.(?:png|jpe?g|webp|gif)$/i.test(properties.hero)?properties.hero:'';
 const depth=path.split('/').length-1;
 const image=hero?`![Header image](${'../'.repeat(depth)}${hero})`:'*[Add a header image in the note sidebar]*';
 const description=typeof properties.description==='string'&&properties.description.trim()?properties.description.trim().split(/\r?\n/).map(line=>`> ${line}`).join('\n'):'> Add a description in the note sidebar';
 return `${start}\n${image}\n\n${description}\n\n${tags.length?tags.map(tag=>`#${tag}`).join(' '):'*Add tags in the note sidebar*'}\n${end}`;
}
export function refreshHeroSection(content:string,path:string):string{
 return sectionPattern.test(content)?content.replace(sectionPattern,heroSectionMarkdown(content,path)):content;
}
export function insertHeroSection(content:string,path:string,offset:number):string{
 if(sectionPattern.test(content))return content;
 const frontmatter=content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
 const at=Math.max(frontmatter?.[0].length??0,Math.min(offset,content.length));
 const result=content.slice(0,at)+`${at&&content[at-1]!=='\n'?'\n':''}\n${heroSectionMarkdown(content,path)}\n\n`+content.slice(at);
 return result;
}
