import React from 'react';

/** Server-only file tree boundary. */
export function WorkspaceMounts({children}:{children:React.ReactNode}){
 return <>{children}</>;
}

export function ServerSettings(_props?:{beforeChange?:()=>Promise<void>;onDisconnected?:()=>void;onError?:(message:string)=>void}){
 return <section className="server-settings" aria-label="Server workspace">
  <h2>Server workspace</h2>
  <p>Spire stores this workspace on the server. Files remain ordinary portable Markdown and attachments.</p>
 </section>;
}
