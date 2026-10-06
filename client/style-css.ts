const forbidden=/@import\b|url\s*\(|@(?:namespace|charset|supports|layer|container|document|page|font-face|keyframes)\b/i;

/** Scope a deliberately small, portable CSS subset to one rendered file. */
export function scopeFileCss(css:string,scope:string){
 if(forbidden.test(css))throw new Error('CSS imports, URLs, and unsafe at-rules are not allowed.');
 const prefix=`.preview[data-style-scope="${CSS.escape(scope)}"]`;
 return css.replace(/(^|})(\s*)([^@{}][^{}]*)\{/g,(_all,close,space,selectors)=>{
  const scoped=String(selectors).split(',').map(selector=>{
   const clean=selector.trim();
   if(!clean)throw new Error('CSS contains an empty selector.');
   if(/\b(?:html|body|:root)\b/i.test(clean))throw new Error('CSS selectors cannot target the application root.');
   return `${prefix} ${clean}`;
  }).join(', ');
  return `${close}${space}${scoped}{`;
 });
}
