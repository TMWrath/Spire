import React,{useMemo} from 'react';
import type {Note} from '../shared/model';
import {collectFileMedia} from './file-media';
import {MediaGallery} from './MediaGallery';
export function MediaPanel({note,notes,attachments}:{note:Note;notes:Note[];attachments:string[]}){
 const items=useMemo(()=>collectFileMedia(note,notes,attachments),[note,notes,attachments]);
 return <section className="file-media" role="tabpanel" aria-label="File media"><h2>Media</h2><p className="media-caption">Media used in {note.path.split('/').at(-1)}. References are collected automatically; originals stay where they are.</p>{items.length?<MediaGallery key={note.id} items={items}/>:<p className="media-empty">No media used in this file.</p>}</section>;
}
