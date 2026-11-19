export type FilePresentation='list'|'wiki'|'manuscript'|'calendar'|'diagram'|'tasks';

const marker=/^<!-- spire:presentation ([a-z][a-z0-9-]*) -->\r?\n/;
const supported=new Set<FilePresentation>(['list','wiki','manuscript','calendar','diagram','tasks']);

export function filePresentation(content:string):FilePresentation|null{
 const value=marker.exec(content)?.[1] as FilePresentation|undefined;
 return value&&supported.has(value)?value:null;
}

export function setFilePresentation(content:string,presentation:FilePresentation|null):string{
 const body=content.replace(marker,'');
 return presentation?`<!-- spire:presentation ${presentation} -->\n${body}`:body;
}
