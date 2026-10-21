export type VoiceLanguage='auto'|'en'|'de'|'fr'|'es'|'it'|'nl'|'pl';
export type DetectedVoiceLanguage=Exclude<VoiceLanguage,'auto'>|'';
export const VOICE_LANGUAGE_KEY='spire.voice.language';
export const VOICE_KEYWORDS_KEY='spire.voice.keywords';
export const VOICE_LANGUAGES:ReadonlyArray<{value:VoiceLanguage;label:string}>=[
 {value:'auto',label:'Auto-detect'},
 {value:'en',label:'English'},
 {value:'de',label:'German'},
 {value:'fr',label:'French'},
 {value:'es',label:'Spanish'},
 {value:'it',label:'Italian'},
 {value:'nl',label:'Dutch'},
 {value:'pl',label:'Polish'},
];
const names=new Map(VOICE_LANGUAGES.map(option=>[option.value,option.label]));
export function normalizeVoiceLanguage(value:string|null):VoiceLanguage{return VOICE_LANGUAGES.some(option=>option.value===value)?value as VoiceLanguage:'auto';}
export function voiceLanguageName(value:DetectedVoiceLanguage):string{return value?names.get(value)??value:'Unknown';}
export function parseVoiceKeywords(value:string):string[]{
 const found:string[]=[];
 for(const raw of value.split(/[,;\n]/)){const term=raw.trim().replace(/\s+/g,' ');if(!term||found.some(item=>item.localeCompare(term,undefined,{sensitivity:'accent'})===0))continue;found.push(term.slice(0,80));if(found.length===32)break;}
 return found;
}
