export type DotFile={id:string;name:string;path:string};
export type DotEdge={source:string;target:string};
export function orderPulseEdges<T extends DotEdge>(edges:T[],depth:(edge:T)=>number):(T&{pulseOffset:number;depth:number})[];
export type DotMapController={select:(id:string|null)=>void;search:(value:string)=>void;pause:(value:boolean)=>void;zoom:(factor:number)=>void;reset:()=>void;destroy:()=>void};
export function createDotMap(canvas:HTMLCanvasElement,options:{files:DotFile[];edges:DotEdge[];onSelect:(id:string|null)=>void;onOpen?:(id:string)=>void}):DotMapController;
