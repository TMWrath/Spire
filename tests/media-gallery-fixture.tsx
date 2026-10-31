import React from 'react';import {createRoot} from 'react-dom/client';import {MediaGallery} from '../client/MediaGallery';
const items=Array.from({length:18},(_,i)=>({kind:(['image','video','audio'] as const)[Math.floor(i/6)],url:Math.floor(i/6)===0?'/image.png':Math.floor(i/6)===1?'/clip.webm':'/tone.mp3',name:'Item '+i,key:String(i),missing:false}));
createRoot(document.getElementById('root')!).render(<MediaGallery items={items} independentScroll={new URLSearchParams(location.search).has('nos')}/>);
