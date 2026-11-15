import React from 'react';
import {Pin} from 'lucide-react';

export function ProjectPinIcon({pinned}:{pinned:boolean}){
 return <Pin className={pinned?'project-pin-icon-pinned':undefined} aria-hidden="true"/>;
}
