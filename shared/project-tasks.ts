import {z} from 'zod';
import {visualGroupsSchema} from './visual-groups.ts';
export const taskBoardSchema=z.object({revision:z.number().int().nonnegative(),tasks:z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(1000),done:z.boolean(),dueDate:z.iso.date().optional()})).max(5000),groups:visualGroupsSchema}).superRefine((b,ctx)=>{if(new Set(b.tasks.map(t=>t.id)).size!==b.tasks.length)ctx.addIssue({code:'custom',message:'Duplicate task identity'});});
export type TaskBoard=z.infer<typeof taskBoardSchema>;
export const emptyTaskBoard=():TaskBoard=>({revision:0,tasks:[],groups:[]});
export const taskProgress=(board:TaskBoard)=>board.tasks.length?Math.round(board.tasks.filter(t=>t.done).length/board.tasks.length*100):0;
