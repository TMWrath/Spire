import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {dateFormats,timeFormats,formatTemporal} from '../client/temporal';
test('date choices emit portable plain text with unambiguous formats',()=>{
 assert.deepEqual(dateFormats.map(f=>formatTemporal('2026-10-08',f)),['2026-10-08','10/08/2026','08/10/2026','Oct 8, 2026','8 October 2026']);
 assert.equal(formatTemporal('2026-02-30','YYYY-MM-DD'),'');
});
test('time choices preserve seconds and correctly handle noon and midnight',()=>{
 assert.deepEqual(timeFormats.map(f=>formatTemporal('09:30:42',f)),['09:30','09:30:42','9:30 AM','9:30:42 AM']);
 assert.equal(formatTemporal('00:05','h:mm A'),'12:05 AM');assert.equal(formatTemporal('12:05','h:mm A'),'12:05 PM');assert.equal(formatTemporal('23:59:59','h:mm:ss A'),'11:59:59 PM');assert.equal(formatTemporal('24:00','HH:mm'),'');
});
