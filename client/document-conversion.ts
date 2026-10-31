import {unzipSync} from 'fflate';
export type DocumentKind='pdf'|'word'|'odf';
export const documentAccept={pdf:'.pdf',word:'.docx',odf:'.odt,.fodt'};
const MAX=20_000_000;
export function documentName(name:string){return name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').trim()||'Converted file';}
export function odfMarkdown(xml:string):string{
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Documents with XML entities are not supported.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('The OpenDocument XML is invalid.');
 const textNS='urn:oasis:names:tc:opendocument:xmlns:text:1.0';
 const plain=(node:Node):string=>{if(node.nodeType===3)return node.textContent??'';if(!(node instanceof Element))return '';if(node.namespaceURI===textNS){if(node.localName==='s'){const count=Number(node.getAttributeNS(textNS,'c')||1);return ' '.repeat(Math.min(100,Math.max(1,count||1)));}if(node.localName==='tab')return '\t';if(node.localName==='line-break')return '\n';}return Array.from(node.childNodes).map(plain).join('');};
 const blocks=Array.from(doc.getElementsByTagNameNS(textNS,'*')).filter(e=>e.localName==='p'||e.localName==='h');
 return blocks.map(e=>{const content=plain(e);if(e.localName==='h'){const level=Math.max(1,Math.min(6,Number(e.getAttributeNS(textNS,'outline-level'))||1));return '#'.repeat(level)+' '+content;}return content;}).join('\n\n').trim();
}
export async function convertDocument(file:File,kind:DocumentKind):Promise<{markdown:string;warning:string}>{
 if(!file.size)throw Error('This file is empty.');if(file.size>MAX)throw Error('Choose a document smaller than 20 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase();if(!documentAccept[kind].split(',').includes('.'+ext))throw Error('Choose '+documentAccept[kind]+' files. Older .doc files must first be saved as .docx.');
 const buffer=await file.arrayBuffer();if(ext==='docx'||ext==='odt'){let total=0,count=0;unzipSync(new Uint8Array(buffer),{filter:entry=>{total+=entry.originalSize;count++;if(total>40_000_000||count>5000)throw Error('This document archive is too large to unpack safely.');return false;}});}let markdown='',warning='Formatting may differ. Review the editable Markdown before creating your file. Embedded images and exact page layout are not imported.';
 if(kind==='pdf'){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const loading=pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true});
  try{const pdf=await loading.promise;if(pdf.numPages>300)throw Error('Choose a PDF with 300 pages or fewer.');const pages:string[]=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();let text='';for(const item of content.items){if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');}pages.push(text.trim());if(pages.join('').length>2_000_000)throw Error('This document contains too much text.');page.cleanup();}markdown=pages.join('\n\n---\n\n');warning='Text extraction only: scanned/image-only PDFs need OCR, which is not included. Columns, tables, and page layout may need correction.';}finally{await loading.destroy();}
 }else if(kind==='word'){
  const mammoth=await import('mammoth/mammoth.browser');const result=await mammoth.extractRawText({arrayBuffer:buffer});markdown=result.value.trim();warning='Word text is imported as paragraphs. Styles, tables, embedded images, and exact page layout are not preserved. Review before creating.';
 }else{
  let xml:string;if(ext==='fodt')xml=new TextDecoder().decode(buffer);else{
   const files=unzipSync(new Uint8Array(buffer),{filter:entry=>{if(entry.name!=='content.xml')return false;if(entry.originalSize>8_000_000)throw Error('OpenDocument content is too large.');return true;}});if(!files['content.xml'])throw Error('This OpenDocument has no content.xml.');xml=new TextDecoder().decode(files['content.xml']);
  }markdown=odfMarkdown(xml);
 }
 if(!markdown.replace(/[\s-]/g,''))throw Error(kind==='pdf'?'No readable text found. This PDF may be scanned and require OCR.':'No readable text found in this document.');
 if(markdown.length>2_000_000)throw Error('The converted text is too large.');return {markdown,warning};
}
