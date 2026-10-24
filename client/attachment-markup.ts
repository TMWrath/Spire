export function attachmentMarkup(name:string,relative:string,mime:string){
 const url=relative.split('/').map(encodeURIComponent).join('/').replace(/\(/g,'%28').replace(/\)/g,'%29');
 const label=name.replace(/[\[\]\\\r\n]/g,'');
 if(mime.startsWith('video/'))return `<video controls src="${url}"></video>`;
 if(mime.startsWith('audio/'))return `<audio controls src="${url}"></audio>`;
 return `${mime.startsWith('image/')?'!':''}[${label}](${url})`;
}
