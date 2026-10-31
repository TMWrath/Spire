import {z} from 'zod';
import {safePath} from './model.ts';
export const quickActionInputSchema=z.object({label:z.string().trim().min(1).max(100),folder:safePath,namePattern:z.string().trim().min(1).max(120).refine(s=>safePath.safeParse(s.replace(/\{date\}/g,'2026-01-01').replace(/\{time\}/g,'12-00-00')).success&&!s.includes('/')&&s.replace(/\.md$/i,'').length>0,'Use a portable filename; {date} and {time} are supported'),templateId:z.string().max(100).nullable().default(null)});
export const quickActionSchema=quickActionInputSchema.extend({id:z.string().uuid(),revision:z.number().int().positive()});
export type QuickAction=z.infer<typeof quickActionSchema>;
export type QuickActionInput=z.infer<typeof quickActionInputSchema>;
export function actionStem(pattern:string,date=new Date()){
 const pad=(n:number)=>String(n).padStart(2,'0');
 return pattern.replace(/\{date\}/g,`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`).replace(/\{time\}/g,`${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`).replace(/\.md$/i,'');
}
