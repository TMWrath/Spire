import {z} from 'zod';
import {buildWorkspaceIndex,compareWorkspace,contentFingerprint,workspaceIndexSchema} from '../shared/workspace-index.ts';
import type {Store} from './store.ts';
export const workspaceBaseline=workspaceIndexSchema;
export function workspaceSnapshot(store:Store){return {seq:store.state.seq,visualGroups:store.state.visualGroups??{},quickActions:store.state.quickActions??[],sources:store.state.sources??[],templates:store.state.templates??[],notes:Object.values(store.state.notes),folders:store.state.folders??[],styles:store.state.styles??{},conflicts:store.state.conflicts,attachments:store.state.attachments.map(a=>({path:a.path,size:Buffer.from(a.data,'base64').length,contentHash:contentFingerprint(a.data)}))};}
const cached=new WeakMap<Store,{state:Store['state'];index:ReturnType<typeof buildWorkspaceIndex>}>();
export function workspaceIndex(store:Store){const previous=cached.get(store);if(previous?.state===store.state)return previous.index;const index=buildWorkspaceIndex(workspaceSnapshot(store));cached.set(store,{state:store.state,index});return index;}
export function workspaceCompare(store:Store,input:unknown){return compareWorkspace(workspaceSnapshot(store),workspaceBaseline.parse(input));}
