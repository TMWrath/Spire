export type FilePresentation='list'|'wiki'|'manuscript'|'calendar'|'diagram'|'tasks';

const frontmatter=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const marker=/^<!-- spire:presentation ([a-z][a-z0-9-]*) -->\r?\n/;
const supported=new Set<FilePresentation>(['list','wiki','manuscript','calendar','diagram','tasks']);

export function filePresentation(content:string):FilePresentation|null{
 const value=marker.exec(content.replace(frontmatter,''))?.[1] as FilePresentation|undefined;
 return value&&supported.has(value)?value:null;
}

export function setFilePresentation(content:string,presentation:FilePresentation|null):string{
 const head=frontmatter.exec(content)?.[0]??'';
 const body=content.slice(head.length).replace(marker,'');
 return head+(presentation?`<!-- spire:presentation ${presentation} -->\n${body}`:body);
}
