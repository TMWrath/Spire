// First-party public-media resolver. No extraction/player libraries or remote code execution.
import http,{type IncomingMessage} from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';
import type {Express} from 'express';
import {HttpError} from './store.ts';
export function publicIPv4(ip:string){
 if(isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
export function videoURL(value:string){
 let u:URL;try{u=new URL(value);}catch{throw new HttpError(400,'Enter a complete public HTTP or HTTPS video URL.');}
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&u.port!=='80'&&u.port!=='443'||value.length>8000)throw new HttpError(400,'Only public HTTP/HTTPS video URLs on standard ports are supported.');
 const host=u.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||isIP(host)&&!publicIPv4(host)||host.includes(':'))throw new HttpError(400,'Private-network video URLs are not allowed. Use a local file instead.');
 u.hash='';return u;
}
async function open(value:string,range?:string,redirects=0):Promise<{response:IncomingMessage;url:string}>{
 const url=videoURL(value);if(redirects>4)throw new HttpError(422,'Too many video redirects.');
 const addresses=await lookup(url.hostname,{all:true,family:4});if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw new HttpError(400,'Video host resolves to a private or reserved network.');
 const address=addresses[0].address;
 return new Promise((resolve,reject)=>{
  // Pin the validated address at connection time; never resolve again in the HTTP client.
  const req=(url.protocol==='https:'?https:http).get(url,{family:4,lookup:(_host,_options,callback)=>callback(null,address,4),headers:{'User-Agent':'Spire-Video/1.0','Accept-Encoding':'identity',...(range?{Range:range}:{})}},response=>{
   const code=response.statusCode??500;
   if([301,302,303,307,308].includes(code)&&response.headers.location){response.destroy();void open(new URL(response.headers.location,url).href,range,redirects+1).then(resolve,reject);return;}
   if(code<200||code>=300){response.destroy();reject(new HttpError(422,`Video host returned HTTP ${code}. Use an accessible video link or local file.`));return;}
   resolve({response,url:url.href});
  });
  req.setTimeout(20000,()=>req.destroy(new Error('Video host timed out.')));req.on('error',()=>reject(new HttpError(422,'Video host could not be reached.')));
 });
}
function decode(s:string){return s.replace(/&(?:amp|quot|apos|lt|gt|#39|#x27|#(\d+));/gi,(m,n)=>n?String.fromCodePoint(Math.min(Number(n),0x10ffff)):({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"}[m.toLowerCase()]??m));}
function jsonObject(html:string,marker:string):any{
 const at=html.indexOf(marker);if(at<0)return null;const start=html.indexOf('{',at+marker.length);if(start<0)return null;
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{return null;}}}return null;
}
export function parseVideoPage(html:string,base:string){
 const meta=new Map<string,string>();for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){const attrs=new Map<string,string>();for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs.set(m[1].toLowerCase(),decode(m[2]??m[3]));const key=attrs.get('property')??attrs.get('name');if(key)meta.set(key.toLowerCase(),attrs.get('content')??'');}
 let title=meta.get('og:title')??decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]??''),author=meta.get('author')??'',media='';
 const yt=jsonObject(html,'ytInitialPlayerResponse');if(yt){title=yt.videoDetails?.title??title;author=yt.videoDetails?.author??author;const formats=yt.streamingData?.formats;if(Array.isArray(formats))media=formats.filter((f:any)=>typeof f.url==='string'&&/^video\/(mp4|webm)/.test(f.mimeType??'')&&!f.drmFamilies&&!f.signatureCipher&&!f.cipher).sort((a:any,b:any)=>(b.height??0)-(a.height??0))[0]?.url??'';}
 if(!media){const candidate=meta.get('og:video:secure_url')??meta.get('og:video:url')??meta.get('og:video')??/<(?:video|source)\b[^>]*\bsrc=["']([^"']+)["']/i.exec(html)?.[1]??'';if(candidate){try{const u=new URL(decode(candidate),base);if(/\.(mp4|webm|ogv)(?:$|\?)/i.test(u.href))media=u.href;}catch{}}}
 return {title:String(title).slice(0,300),author:String(author).slice(0,300),media};
}
function mediaType(r:IncomingMessage,url:string){const type=(r.headers['content-type']??'').split(';')[0].toLowerCase();if(['video/mp4','video/webm','video/ogg'].includes(type))return type;if(type==='application/octet-stream'){const ext=new URL(url).pathname.split('.').pop();return ({mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg'} as Record<string,string>)[ext??'']??'';}return '';}
async function textBody(r:IncomingMessage){const chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>r.destroy(new Error('Page timeout')),20000);try{for await(const chunk of r){size+=chunk.length;if(size>3_000_000)throw new HttpError(422,'Video page is too large to inspect safely.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks).toString('utf8');}finally{clearTimeout(timer);r.destroy();}}
export function registerVideo(app:Express){
 const tickets=new Map<string,{device:string;url:string;type:string;expires:number}>();let resolving=0,streaming=0;
 app.post('/api/video/resolve',async(req,res)=>{
  if(resolving>=3)throw new HttpError(429,'Video resolver is busy. Try again shortly.');resolving++;
  try{
   const input=videoURL(typeof req.body?.url==='string'?req.body.url:'').href;
   let {response,url}=await open(input),type=mediaType(response,url),title=decodeURIComponent(new URL(input).pathname.split('/').pop()||'Online video').slice(0,300),author='',media=url;
   if(type)response.destroy();else{
    if(!(response.headers['content-type']??'').includes('text/html')){response.destroy();throw new HttpError(422,'This link is not a supported video or video page.');}
    const parsed=parseVideoPage(await textBody(response),url);title=parsed.title||title;author=parsed.author;media=parsed.media;
    if(!media){
     const host=new URL(input).hostname;
     if(/(^|\.)youtube\.com$|^youtu\.be$/.test(host)){
      try{const meta=await open('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(input));const data=JSON.parse(await textBody(meta.response));if(typeof data.title==='string')title=data.title.slice(0,300);if(typeof data.author_name==='string')author=data.author_name.slice(0,300);}catch{/* Missing metadata stays unknown; never invent attribution. */}
     }
     res.json({title,author,url:input,platform:new URL(input).hostname,playback:'',message:'This page does not expose an accessible video feed. Open it in your browser and use Record video tab (desktop), or choose a local copy you are permitted to use. Protected video cannot be captured.'});return;}
    const next=await open(media);type=mediaType(next.response,next.url);media=next.url;next.response.destroy();if(!type)throw new HttpError(422,'The page does not provide a browser-playable MP4, WebM or Ogg feed.');
   }
   for(const [id,t]of tickets)if(t.expires<Date.now())tickets.delete(id);if(tickets.size>=64)tickets.delete(tickets.keys().next().value!);
   const id=randomUUID();tickets.set(id,{device:res.locals.device.id,url:media,type,expires:Date.now()+60*60*1000});
   res.json({title,author,url:input,platform:new URL(input).hostname,playback:'/api/video/stream/'+id,message:''});
  }finally{resolving--;}
 });
 app.get('/api/video/stream/:id',async(req,res)=>{
  const t=tickets.get(String(req.params.id));if(!t||t.device!==res.locals.device.id||t.expires<Date.now())throw new HttpError(404,'Video session expired. Open the link again.');
  if(streaming>=6)throw new HttpError(429,'Too many simultaneous video streams.');
  const range=req.headers.range;if(range&&!/^bytes=\d+-\d*$/.test(range))throw new HttpError(400,'Unsupported video byte range.');
  streaming++;let response:IncomingMessage|undefined;
  try{const opened=await open(t.url,range);response=opened.response;const type=mediaType(response,opened.url);if(!type){response.destroy();throw new HttpError(422,'Video host no longer returns video.');}
   res.status(response.statusCode??200).type(type);res.set('X-Content-Type-Options','nosniff');for(const name of ['content-length','content-range','accept-ranges']){const value=response.headers[name];if(typeof value==='string')res.set(name,value);}
   let bytes=0;const timer=setTimeout(()=>response?.destroy(),120000);const close=()=>response?.destroy();res.on('close',close);
   try{for await(const chunk of response){bytes+=chunk.length;if(bytes>256*1024*1024)throw new Error('Stream request exceeds limit');if(!res.write(chunk))await new Promise<void>(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});if(res.destroyed)break;}res.end();}finally{clearTimeout(timer);res.off('close',close);}
  }catch(e){if(res.headersSent)res.destroy();else throw e;}finally{response?.destroy();streaming--;}
 });
}
