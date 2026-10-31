import {mountEditorAudio} from './editor-audio';
import {enhanceVideos} from './video-player';
export function enhanceMedia(root:HTMLElement){const audio=mountEditorAudio(root),video=enhanceVideos(root);return()=>{audio();video();};}
