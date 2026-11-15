import React from 'react';
import {ArrowUpToLine,Pin} from 'lucide-react';

export function ProjectPinIcon({pinned}:{pinned:boolean}){
 return pinned?<ArrowUpToLine aria-hidden="true"/>:<Pin aria-hidden="true"/>;
}
