import React from 'react';
import {MergeSections} from './MergeSections';
import {mounted,type PublicationReview as Review} from './sync';
export function PublicationReview({id,resolve}:{id:string;resolve:(review:Review,content:string)=>Promise<void>}){
 const review=mounted.publicationReviews.find(r=>r.id===id);if(!review)return null;
 const textOnly=!review.local.deleted&&!review.server.deleted&&review.local.path===review.server.path;
 return <section className="conflict" aria-label="Local publication conflict"><h3>Local ↔ Server conflict</h3><p>{review.local.path}</p>{textOnly?<MergeSections key={review.local.rev+':'+review.server.rev+':'+review.local.content+review.server.content} base={review.base.content} local={review.local.content} server={review.server.content} save={content=>resolve(review,content)}/>:<p>The path or deletion state also differs. Both copies are preserved; resolve that change before combining text.</p>}</section>;
}
