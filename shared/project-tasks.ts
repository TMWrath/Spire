import {z} from 'zod';
import {visualGroupsSchema} from './visual-groups.ts';
const taskTagSchema=z.string().trim().toLowerCase().min(1).max(32).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Use lowercase words, numbers, and hyphens');
const taskImage=z.string().regex(/^Attachments\/tasks\/[a-f0-9-]+\.(png|jpg|webp|gif)$/);
export const taskBoardSchema=z.object({revision:z.number().int().nonnegative(),tasks:z.array(z.object({id:z.string().uuid(),shortId:z.number().int().positive().optional(),title:z.string().trim().min(1).max(1000),details:z.string().max(10_000).optional(),done:z.boolean(),dueDate:z.iso.date().optional(),fileId:z.string().uuid().optional(),priority:z.enum(['none','low','medium','high','urgent']).optional(),tags:z.array(taskTagSchema).max(20).transform(tags=>[...new Set(tags)]).optional(),image:taskImage.optional(),images:z.array(taskImage).max(30).optional()})).max(5000),groups:visualGroupsSchema}).superRefine((b,ctx)=>{if(new Set(b.tasks.map(t=>t.id)).size!==b.tasks.length)ctx.addIssue({code:'custom',message:'Duplicate task identity'});const numbered=b.tasks.flatMap(t=>t.shortId?[t.shortId]:[]);if(new Set(numbered).size!==numbered.length)ctx.addIssue({code:'custom',message:'Duplicate task number'});});
export type TaskBoard=z.infer<typeof taskBoardSchema>;
export const emptyTaskBoard=():TaskBoard=>({revision:0,tasks:[],groups:[]});
export const taskProgress=(board:TaskBoard)=>board.tasks.length?Math.round(board.tasks.filter(t=>t.done).length/board.tasks.length*100):0;
