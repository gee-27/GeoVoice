import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {questions} from '../backend/questions.js';
import {questionImage,questionImages} from '../dist/visuals.js';
test('all forty questions have explicit subject images independent of correct choices',async()=>{
 assert.equal(Object.keys(questionImages).length,40);
 for(const q of questions){const image=questionImage(q);assert.ok(questionImages[q.id]);assert.ok(image.alt.length>10);const bytes=await readFile(new URL('../dist/images/'+image.file,import.meta.url));assert.ok(bytes.length>100&&bytes.length<700000);assert.equal(questionImage({...q,answer:99,options:['changed']}),image);}
 assert.match(questionImage(questions[0]).file,/flag-jp/);assert.match(questionImage(questions[23]).file,/volcano/);assert.match(questionImage(questions[26]).file,/cave/);assert.match(questionImage(questions[38]).file,/lake/);assert.match(questionImage(questions[39]).file,/waterfall/);
});
