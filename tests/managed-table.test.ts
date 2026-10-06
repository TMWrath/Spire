import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {findManagedTableAt,managedTableMarkdown,placeManagedTable} from '../shared/managed-table';

test('Markdown column alignments round-trip without changing cell content',()=>{
 const cells=[['A','B','C'],['one','two','three']];
 const block=managedTableMarkdown('aligned',cells,['left','center','right']);
 assert.ok(block.includes('| :--- | :---: | ---: |'));assert.ok(!block.includes('<div'));
 const parsed=findManagedTableAt(block,0)!;assert.deepEqual(parsed.cells,cells);assert.deepEqual(parsed.alignments,['left','center','right']);
 const result=placeManagedTable(block,0,[['A','B','C'],['updated','two','three']],parsed);
 assert.ok(result.content.includes('| :--- | :---: | ---: |'));
});
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

test('rich-cell Markdown escapes and marks survive the table storage boundary',()=>{
 const cells=[['Title'],['Literal \\*asterisks\\* and **bold** with \\[brackets\\]']];
 const block=managedTableMarkdown('rich',cells);
 assert.ok(block.includes('| Literal \\*asterisks\\* and **bold** with \\[brackets\\] |'));
 assert.deepEqual(findManagedTableAt(block,0)?.cells,cells);
});
