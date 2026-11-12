import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createNarrator, narrationTexts } from '../dist/narration.js';
import { generateVoice, voiceClips, clipFile } from '../scripts/generate-voice.mjs';

const question = { prompt: 'What is the capital of Japan?', options: ['Tokyo', 'Kyoto', 'Osaka', 'Nagoya'] };

function setup({ missing = null, manifestOk = true } = {}) {
  const clips = {};
  narrationTexts(question).forEach((text, i) => { if (text !== missing) clips[text] = `c${i.toString(16).padStart(2, '0')}.mp3`; });
  const requested = [], played = [];
  class FakeAudio {
    play() { const src = this.src; played.push(src); setTimeout(() => { if (this.src === src) this.onended?.(); }, 1); return Promise.resolve(); }
    pause() {}
  }
  const fetchImpl = async url => {
    requested.push(url);
    if (url.endsWith('manifest.json')) return manifestOk ? { ok: true, json: async () => ({ clips }) } : { ok: false };
    return { ok: true, blob: async () => new Blob([url]) };
  };
  const narrator = createNarrator({ fetchImpl, AudioImpl: FakeAudio, makeUrl: () => 'blob:' + (urlCounter++), gapMs: 0 });
  return { narrator, clips, requested, played };
}
let urlCounter = 0;

test('narration reads the prompt, then each lettered option, then reports completion', async () => {
  const { narrator, clips, requested, played } = setup();
  let ended = 0;
  assert.equal(await narrator.speak(question, { onend: () => ended++ }), true);
  assert.equal(ended, 1);
  const files = narrationTexts(question).map(text => clips[text]);
  assert.deepEqual(requested.filter(url => url.endsWith('.mp3')), files.map(file => './audio/' + file));
  assert.equal(played.length, 1 + files.length); // one silent unlock plus every clip
  assert.deepEqual(narrationTexts(question).slice(0, 3), [question.prompt, 'Option A', 'Tokyo']);
});

test('falls back to the browser voice when a clip is missing or the manifest is unavailable', async () => {
  assert.equal(await setup({ missing: 'Kyoto' }).narrator.speak(question, { onend() { throw new Error('must not complete'); } }), false);
  assert.equal(await setup({ manifestOk: false }).narrator.speak(question), false);
});

test('stop cancels playback without reporting completion', async () => {
  const { narrator } = setup();
  let ended = 0;
  const speaking = narrator.speak(question, { onend: () => ended++ });
  await new Promise(resolve => setTimeout(resolve, 5));
  narrator.stop();
  assert.equal(await speaking, true);
  assert.equal(ended, 0);
});

test('generator lists each phrase once and covers every letter', () => {
  const clips = voiceClips([question, { prompt: 'Another?', options: ['Tokyo', 'Rome', 'Oslo', 'Lima'] }]);
  assert.equal(clips.length, new Set(clips).size);
  for (const letter of ['Option A', 'Option B', 'Option C', 'Option D', 'Tokyo', 'Lima', 'Another?']) assert.ok(clips.includes(letter));
});

test('generator calls ElevenLabs for missing clips only and writes a usable manifest', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'geovoice-voice-'));
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
  const env = { ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_VOICE_ID: 'voice123' };
  const clips = voiceClips([question]);
  const first = await generateVoice({ clips, env, fetchImpl, outDir, log() {} });
  assert.equal(first.created, clips.length);
  const call = calls[0];
  assert.match(call.url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/voice123\?output_format=mp3_44100_128$/);
  assert.equal(call.options.headers['xi-api-key'], 'test-key');
  assert.equal(JSON.parse(call.options.body).model_id, 'eleven_multilingual_v2');
  const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
  const settings = { model: 'eleven_multilingual_v2', voice: 'voice123', format: 'mp3_44100_128' };
  assert.equal(manifest.clips['Tokyo'], clipFile('Tokyo', settings));
  assert.equal(JSON.stringify(manifest).includes('test-key'), false);

  const second = await generateVoice({ clips, env, fetchImpl, outDir, log() {} });
  assert.equal(second.created, 0);
  assert.equal(calls.length, clips.length);
});

test('generator retries rate limits, stops on bad credentials, and dry runs make no requests', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'geovoice-voice-'));
  const env = { ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v' };
  let attempts = 0;
  const flaky = async () => (++attempts === 1
    ? { ok: false, status: 429, headers: new Headers({ 'retry-after': '0' }), text: async () => 'slow down' }
    : { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer });
  const result = await generateVoice({ clips: ['Tokyo'], env, fetchImpl: flaky, outDir, sleep: async () => {}, log() {} });
  assert.equal(result.created, 1);
  assert.equal(attempts, 2);

  let denied = 0;
  const unauthorized = async () => { denied++; return { ok: false, status: 401, headers: new Headers(), text: async () => 'bad key' }; };
  const stopped = await generateVoice({ clips: ['A', 'B', 'C'], env, fetchImpl: unauthorized, outDir: await mkdtemp(path.join(os.tmpdir(), 'geovoice-voice-')), log() {} });
  assert.equal(denied, 1);
  assert.equal(stopped.failed, 1);

  const dry = await generateVoice({ clips: ['Tokyo'], env: {}, fetchImpl: () => { throw new Error('no network in a dry run'); }, outDir, dryRun: true, log() {} });
  assert.equal(dry.chars, 5);
  await writeFile(path.join(outDir, 'keep.txt'), 'x');
  assert.ok((await readdir(outDir)).includes('keep.txt'));
});
