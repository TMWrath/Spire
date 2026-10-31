// Synthetic demo data; never persisted or connected to workspace APIs.
const names=['The Observatory','Light & Shadow','Camera Studies','Spatial Language','Interaction Sketches','Depth Cues','Visual Rhythm','World Atlas','Northern Coast','Old City','Hidden Routes','Landmarks','Weather Patterns','Field Reports','Story Architecture','Chapter One','Character Threads','Turning Points','Timeline','Unfinished Scenes','Final Pages','Sound Library','Night Drive','Low Frequencies','Melody Studies','Transitions','Quiet Hours','Afterglow'];
export const files=names.map((name,i)=>({id:`file-${i}`,name,path:`Demo/${name}.md`}));
export const edges=[];for(let i=0;i<files.length;i++){
 const group=Math.floor(i/7)*7;edges.push({source:files[i].id,target:files[group+(i+1)%7].id});
 if(i%2===0)edges.push({source:files[i].id,target:files[group+(i+3)%7].id});
 if(i%7===0)edges.push({source:files[i].id,target:files[(i+7)%files.length].id});
}
