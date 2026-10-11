// First-party public-media resolver. No extraction/player libraries or remote code execution.
import {discoverVideo,extractPage} from './video-extractor.ts';
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
async function open(value:string,range?:string,redirects=0,signal:AbortSignal=AbortSignal.timeout(120000)):Promise<{response:IncomingMessage;url:string}>{
 const url=videoURL(value);if(redirects>4)throw new HttpError(422,'Too many video redirects.');
 signal.throwIfAborted();
 const addresses=await new Promise<{address:string;family:number}[]>((resolve,reject)=>{
  const abort=()=>reject(new HttpError(422,'Video lookup timed out.'));signal.addEventListener('abort',abort,{once:true});
  void lookup(url.hostname,{all:true,family:4}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw new HttpError(400,'Video host resolves to a private or reserved network.');
 const address=addresses[0].address;
 return new Promise((resolve,reject)=>{
  // Pin the validated address at connection time; never resolve again in the HTTP client.
  const req=(url.protocol==='https:'?https:http).get(url,{signal,family:4,lookup:(_host,_options,callback)=>callback(null,address,4),headers:{'User-Agent':'Spire-Video/1.0','Accept-Encoding':'identity',...(range?{Range:range}:{})}},response=>{
   const code=response.statusCode??500;
   if([301,302,303,307,308].includes(code)&&response.headers.location){response.destroy();try{void open(new URL(response.headers.location,url).href,range,redirects+1,signal).then(resolve,reject);}catch{reject(new HttpError(422,'Video host returned an invalid redirect.'));}return;}
   if(code<200||code>=300){response.destroy();reject(new HttpError(422,`Video host returned HTTP ${code}. Use an accessible video link or local file.`));return;}
   resolve({response,url:url.href});
  });
  req.setTimeout(20000,()=>req.destroy(new Error('Video host timed out.')));req.on('error',()=>reject(new HttpError(422,'Video host could not be reached.')));
 });
}
export {extractPage} from './video-extractor.ts';
export function parseVideoPage(html:string,base:string){const p=extractPage(html,base);return {title:p.title,author:p.author,media:p.candidates[0]?.url??''};}
function mediaType(r:IncomingMessage,url:string){const type=(r.headers['content-type']??'').split(';')[0].toLowerCase();if(['video/mp4','video/webm','video/ogg'].includes(type))return type;if(type==='application/octet-stream'){const ext=new URL(url).pathname.split('.').pop();return ({mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg'} as Record<string,string>)[ext??'']??'';}return '';}
async function textBody(r:IncomingMessage){const chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>r.destroy(new Error('Page timeout')),20000);try{for await(const chunk of r){size+=chunk.length;if(size>3_000_000)throw new HttpError(422,'Video page is too large to inspect safely.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks).toString('utf8');}finally{clearTimeout(timer);r.destroy();}}
export function registerVideo(app:Express){
 const tickets=new Map<string,{device:string;url:string;type:string;expires:number}>();let resolving=0,streaming=0;
 app.post('/api/video/resolve',async(req,res)=>{
  if(resolving>=3)throw new HttpError(429,'Video resolver is busy. Try again shortly.');resolving++;
  try{
   const input=videoURL(typeof req.body?.url==='string'?req.body.url:'').href;
   const signal=AbortSignal.timeout(30000);
   const resolved=await discoverVideo(input,async value=>{
    signal.throwIfAborted();const {response,url}=await open(value,undefined,0,signal);const media=mediaType(response,url);
    if(media){response.destroy();return {url,type:media};}
    const type=(response.headers['content-type']??'').split(';')[0].toLowerCase();
    if(!type.includes('html')&&!type.includes('json')){response.destroy();return {url,type};}
    return {url,type,text:await textBody(response)};
   });
   const {title,author,media,type,extractor}=resolved;
   if(!media){res.json({title,author,url:input,platform:new URL(input).hostname,extractor,playback:'',message:resolved.reason});return;}
   for(const [id,t]of tickets)if(t.expires<Date.now())tickets.delete(id);if(tickets.size>=64)tickets.delete(tickets.keys().next().value!);
   const id=randomUUID();tickets.set(id,{device:res.locals.device.id,url:media,type,expires:Date.now()+60*60*1000});
   res.json({title,author,url:input,platform:new URL(input).hostname,extractor,playback:'/api/video/stream/'+id,message:'Resolved by Spire’s '+extractor+' extractor. Review attribution before capture.'});
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
