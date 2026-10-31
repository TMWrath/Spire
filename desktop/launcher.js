document.querySelector('#backup').addEventListener('click',()=>run(()=>window.spireDesktop.backup()));
document.querySelector('#restore').addEventListener('click',()=>run(()=>window.spireDesktop.restore()));
const status=document.querySelector('#status');
const buttons=[...document.querySelectorAll('button')];
async function run(action){buttons.forEach(b=>b.disabled=true);status.textContent='Opening workspace…';try{const result=await action();status.textContent=result.ok?(result.message??''):result.error;}catch{status.textContent='Unable to open workspace. Try again.';}finally{buttons.forEach(b=>b.disabled=false);}}
document.querySelector('#local').addEventListener('click',()=>run(()=>window.spireDesktop.openLocal()));
document.querySelector('#remote').addEventListener('submit',event=>{event.preventDefault();run(()=>window.spireDesktop.openServer(document.querySelector('#server').value));});
