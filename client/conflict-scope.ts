/** Context conflicts belong only to the file whose note id matches the mutation id. */
export function conflictsForNote<T extends {mutation:{id:string}}>(conflicts:readonly T[],noteId:string):T[]{
 return conflicts.filter(conflict=>conflict.mutation.id===noteId);
}
