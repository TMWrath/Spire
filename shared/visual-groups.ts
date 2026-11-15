import {z} from 'zod';

export const visualGroupSchema=z.object({
 id:z.string().uuid(),
 name:z.string().trim().min(1).max(80),
 color:z.string().regex(/^#[0-9a-f]{6}$/i,'Use a six-digit hex color'),
 members:z.array(z.string().min(1).max(300)).max(1000),
 pinned:z.boolean().optional(),
}).strict();

export const visualGroupsSchema=z.array(visualGroupSchema).max(100).superRefine((groups,ctx)=>{
 const ids=new Set<string>(),members=new Set<string>();
 groups.forEach((group,index)=>{
  if(ids.has(group.id))ctx.addIssue({code:'custom',message:'Duplicate group identity',path:[index,'id']});
  ids.add(group.id);
  group.members.forEach((member,memberIndex)=>{
   if(members.has(member))ctx.addIssue({code:'custom',message:'A member can belong to only one group',path:[index,'members',memberIndex]});
   members.add(member);
  });
 });
});
export const visualGroupsByDirectorySchema=z.record(z.string().max(240),visualGroupsSchema);
export type VisualGroup=z.infer<typeof visualGroupSchema>;
