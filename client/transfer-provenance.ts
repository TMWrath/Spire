import type {WireBundle} from '../server/transfer';
import type {MountScope} from '../shared/mounted-workspace';

export type TransferProvenance={origin:string;account:string;workspace:string;revision:number};

/** Attach retained origin metadata only for an explicit Local → Server return.
 * Provenance identifies the original Server file; it never grants background sync.
 */
export function attachReturnProvenance(
 bundle:WireBundle,
 provenance:Record<string,TransferProvenance>|undefined,
 target:MountScope|undefined,
):WireBundle{
 if(target?.kind!=='server')return bundle;
 return {...bundle,files:bundle.files.map(file=>{
  if(file.kind!=='note'||!file.id)return file;
  const origin=provenance?.[file.id];
  if(!origin)return file;
  if(origin.origin!==target.origin||origin.account!==target.account||origin.workspace!==target.workspace)throw Error('This moved file belongs to a different Server account/workspace. Keep both copies and return to the original Server.');
  return {...file,origin};
 })};
}
