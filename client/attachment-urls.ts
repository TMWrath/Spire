let resolver:(path:string)=>string=path=>'/api/attachment?path='+encodeURIComponent(path);
export const attachmentUrl=(path:string)=>resolver(path);
export const setAttachmentResolver=(next:(path:string)=>string)=>{resolver=next;};
