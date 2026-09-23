import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalize,resolveAnswer,buildQuiz,distance,matchesFace,score} from '../dist/core.js';
import {questions,categories} from '../backend/questions.js';
test('question bank: eighty unique questions in eight ten-question categories',()=>{assert.equal(questions.length,80);assert.equal(categories.length,8);assert.equal(new Set(questions.map(q=>q.id)).size,80);for(const c of categories)assert.equal(questions.filter(q=>q.category===c).length,10);for(const q of questions){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation.length>20);}for(const c of categories.slice(4)){assert.equal(questions.filter(q=>q.category===c&&q.difficulty==='easy').length,3);assert.equal(questions.filter(q=>q.category===c&&q.difficulty==='medium').length,4);assert.equal(questions.filter(q=>q.category===c&&q.difficulty==='hard').length,3);}});
test('spoken letters, natural prefixes, punctuation and accent normalization',()=>{const options=['Tokyo','São Paulo','Cairo','Rome'];for(const text of ['A','option A','The answer is Tokyo','Tokyo.','one'])assert.equal(resolveAnswer(text,options),0);assert.equal(resolveAnswer('sao paulo',options),1);assert.equal(resolveAnswer('bee',options),1);assert.equal(resolveAnswer('I choose Rome',options),3);assert.equal(normalize('Brasília!'),'brasilia');});
test('unrecognized, negated and conflicting speech never guesses an answer',()=>{for(const t of ['not Tokyo','maybe Tokyo or Rome','tok','', 'zzzz'])assert.equal(resolveAnswer(t,['Tokyo','Paris','Rome','Cairo']),null);});
test('randomized quizzes retain the correct answer and do not duplicate questions',()=>{for(let i=0;i<30;i++){const quiz=buildQuiz(questions,'All',10);assert.equal(quiz.length,10);assert.equal(new Set(quiz.map(q=>q.id)).size,10);for(const q of quiz){const original=questions.find(o=>o.id===q.id);assert.equal(q.options[q.answer],original.options[original.answer]);}}assert.ok(buildQuiz(questions,'Philippines',10).every(q=>q.category==='Philippines'));});
test('matching requires two new samples and at least two of three matching references',()=>{const a=Array(128).fill(.1),b=Array(128).fill(.11),c=Array(128).fill(.8);assert.ok(matchesFace([a,b],[a,a,b]));assert.ok(!matchesFace([a,c],[a,a,b]));assert.ok(!matchesFace([a],[a,a,b]));assert.ok(!matchesFace([a,b],[a,c,c]));assert.equal(distance([],[]),Infinity);assert.equal(distance(Array(128).fill(NaN),a),Infinity);});
test('score calculation covers empty and mixed results',()=>{assert.deepEqual(score([]),{correct:0,total:0,percent:0});assert.deepEqual(score([{selected:0,question:{answer:0}},{selected:0,question:{answer:1}}]),{correct:1,total:2,percent:50});});
test('all bundled model assets match recorded SHA256 checksums',async()=>{const checks=JSON.parse(await readFile(new URL('../asset-checksums.json',import.meta.url)));for(const [name,hash] of Object.entries(checks)){const data=await readFile(new URL('../dist/'+name,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),hash,name);}});

test('speech phrases, letter plus name, and word spacing match without guessing',()=>{
 const options=['Tokyo','São Paulo','Mount Everest','New Zealand'];
 for(const text of ['my answer is letter A','the answer is option A','A Tokyo','it is Tokyo','Tokyo please'])assert.equal(resolveAnswer(text,options),0);
 assert.equal(resolveAnswer('SaoPaulo',options),1);assert.equal(resolveAnswer('Mt Everest',options),2);
 for(const text of ['B Tokyo','not Tokyo','Tokyo or Sao Paulo','Tokyo sorry Sao Paulo','maybe A','tok'])assert.equal(resolveAnswer(text,options),null);
});
