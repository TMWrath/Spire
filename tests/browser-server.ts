import fs from 'node:fs';
const root='.test-data/browser';if(fs.existsSync(root+'/process.lock'))throw new Error('Browser test data locked');fs.rmSync(root,{recursive:true,force:true});process.env.SPIRE_DATA=root;process.env.PORT='4179';process.env.SPIRE_ORIGIN='http://127.0.0.1:4179';process.env.HOST='127.0.0.1';await import('../server/index.ts');
