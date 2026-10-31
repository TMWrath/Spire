import {createApp} from './app.ts';
import {lock} from './lock.ts';
const port=Number(process.env.PORT??4173), host=process.env.HOST??'127.0.0.1';
const root=process.env.SPIRE_DATA??'runtime';const unlock=lock(root);
try{const{app}=createApp(root,process.env.SPIRE_ORIGIN??`http://127.0.0.1:${port}`);const server=app.listen(port,host,()=>console.log(`Spire listening on ${host}:${port}`));let closing=false;const stop=()=>{if(closing)return;closing=true;server.close(()=>{unlock();process.exit(0);});server.closeAllConnections();};process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('error',e=>{unlock();console.error(e.message);process.exit(1);});}catch(e){unlock();throw e;}
