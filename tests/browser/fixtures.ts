import {test as base,expect} from '@playwright/test';
// Each scenario gets a fresh disposable server app, including auth/limiter state.
// The reset route exists only in browser-server.ts, never in the production app.
export const test=base.extend<{isolatedApp:void}>({isolatedApp:[async({request},use)=>{const response=await request.post('/__test/reset');expect(response.status()).toBe(204);await use();},{auto:true}]});
export {expect};
export type {Page} from '@playwright/test';
