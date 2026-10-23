import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../dist/storage.js',import.meta.url),'utf8')).replaceAll('export ','');
test('startup works without AbortSignal.timeout and always clears request timers',async()=>{
 let callback,cleared=0,calls=0,mode='success';
 const context=vm.createContext({AbortController,AbortSignal:{},setTimeout(fn,ms){assert.equal(ms,25000);callback=fn;return 7;},clearTimeout(id){assert.equal(id,7);cleared++;},fetch:async(url,options)=>{calls++;assert.equal(url,'/api/session');assert.equal(options.credentials,'same-origin');assert.ok(options.signal instanceof AbortSignal);if(mode==='network')throw new TypeError('Network failed');if(mode==='timeout'){callback();assert.equal(options.signal.aborted,true);throw new Error('Aborted');}return {ok:true,json:async()=>({stage:'anonymous'})};}});
 vm.runInContext(source,context);
 assert.equal((await vm.runInContext("api('/session')",context)).stage,'anonymous');
 mode='network';await assert.rejects(vm.runInContext("api('/session')",context),/Could not reach GeoVoice/);
 mode='timeout';await assert.rejects(vm.runInContext("api('/session')",context),/Could not reach GeoVoice/);
 assert.equal(calls,3);assert.equal(cleared,3);
});
