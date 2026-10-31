// Spire owns zoom inside specialist canvases. The application chrome itself
// always stays in the device viewport instead of behaving like a web page.
const browserZoomKey=(event:KeyboardEvent)=>
 (event.ctrlKey||event.metaKey)&&['+','=','-','0'].includes(event.key);
window.addEventListener('keydown',event=>{
 if(browserZoomKey(event))event.preventDefault();
},{capture:true});
window.addEventListener('wheel',event=>{
 if((event.ctrlKey||event.metaKey)&&!(event.target as Element|null)?.closest('.letter-paginated'))event.preventDefault();
},{capture:true,passive:false});