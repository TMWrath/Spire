import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {findManagedTableAt,managedTableMarkdown,placeManagedTable} from '../shared/managed-table';

test('managed table emits portable Markdown wrapped in invisible stable markers',()=>{
 assert.equal(managedTableMarkdown('table-1',[['Name','Notes'],['Ty','A | B']]),'<!-- spire:table id=table-1 -->\n| Name | Notes |\n| --- | --- |\n| Ty | A \\| B |\n<!-- /spire:table -->');
});
test('managed table can be found and read after its block moves in a note',()=>{
 const block=managedTableMarkdown('table-1',[['Name','Notes'],['Ty','Hello']]);
 const content=`Text inserted before it.\n\n${block}\n\nAfter`;
 const found=findManagedTableAt(content,content.indexOf('Hello'));
 assert.equal(found?.id,'table-1');assert.deepEqual(found?.cells,[['Name','Notes'],['Ty','Hello']]);
});
test('managed table updates in place without changing surrounding prose',()=>{
 const original=`Before\n\n${managedTableMarkdown('table-1',[['A'],['B']])}\n\nAfter`;
 const table=findManagedTableAt(original,original.indexOf('| B |'))!;
 const result=placeManagedTable(original,table.start,[['Heading'],['Updated']],table);
 assert.equal(result.content,`Before\n\n${managedTableMarkdown('table-1',[['Heading'],['Updated']])}\n\nAfter`);
});
