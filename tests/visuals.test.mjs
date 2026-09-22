import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {questions} from '../backend/questions.js';
import {contextImage,topicImages} from '../dist/visuals.js';
test('all forty questions have local context photographs independent of answers',async()=>{
 assert.equal(questions.length,40);
 for(const q of questions){const image=contextImage(q.category);assert.ok(topicImages[q.category]);assert.ok(image.alt.length>10);const bytes=await readFile(new URL('../dist/images/'+image.file+'.jpg',import.meta.url));assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length<500000);assert.equal(contextImage(q.category),image);}
});
