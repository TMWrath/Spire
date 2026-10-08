export const dateFormats=['YYYY-MM-DD','MM/DD/YYYY','DD/MM/YYYY','MMM D, YYYY','D MMMM YYYY'] as const;
export const timeFormats=['HH:mm','HH:mm:ss','h:mm A','h:mm:ss A'] as const;
export type TemporalFormat=typeof dateFormats[number]|typeof timeFormats[number];
export function formatTemporal(value:string,format:TemporalFormat):string{
 const pad=(n:number)=>String(n).padStart(2,'0');
 if(dateFormats.includes(format as typeof dateFormats[number])){
  const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);
  if(!y||date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return '';
  switch(format){case 'YYYY-MM-DD':return `${y}-${pad(m)}-${pad(d)}`;case 'MM/DD/YYYY':return `${pad(m)}/${pad(d)}/${y}`;case 'DD/MM/YYYY':return `${pad(d)}/${pad(m)}/${y}`;case 'MMM D, YYYY':return `${date.toLocaleString('en-US',{month:'short'})} ${d}, ${y}`;default:return `${d} ${date.toLocaleString('en-US',{month:'long'})} ${y}`;}
 }
 const [h,m,s=0]=value.split(':').map(Number);if(!Number.isInteger(h)||h<0||h>23||!Number.isInteger(m)||m<0||m>59||!Number.isInteger(s)||s<0||s>59)return '';
 const seconds=format.includes(':ss')?`:${pad(s)}`:'';return format.startsWith('HH')?`${pad(h)}:${pad(m)}${seconds}`:`${h%12||12}:${pad(m)}${seconds} ${h<12?'AM':'PM'}`;
}
