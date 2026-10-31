import {chromium} from '@playwright/test';
const browser=await chromium.connectOverCDP('http://127.0.0.1:19229');
try{const page=browser.contexts()[0].pages()[0];
console.log(await page.evaluate(async()=>{
 const result={origin:location.origin,header:document.querySelector('header')?.innerText,buttons:[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.innerText).filter(Boolean).slice(0,45)};
 result.local=await fetch('/api/snapshot').then(r=>r.json()).then(s=>({notes:s.notes?.length,attachments:s.attachments,workspace:s.localWorkspaceId})).catch(e=>({error:e.message}));
 const req=globalThis.spireRemoteTransport;
 if(req){const response=await req.request({origin:'https://spire.example',path:'/api/device-workspaces/self/delta',method:'GET',headers:{}});const body=JSON.parse(atob(response.body));result.remote={status:response.status,revision:body.revision,attachments:body.snapshot?.attachments,error:body.error};}
 result.operations=JSON.parse(localStorage.getItem('spire-operation-log-v1')??'[]').slice(0,12);
 return result;
}));}finally{await browser.close();}
