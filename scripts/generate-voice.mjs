// Generates the narration clips with ElevenLabs text-to-speech and writes them to dist/audio/.
// Run locally (never on the server): the API key is only needed here, not in production.
//   npm run voice:generate -- --dry-run        count characters, no API calls
//   npm run voice:generate -- --limit=5        generate at most 5 new clips (cheap voice test)
//   npm run voice:generate                     generate every missing clip
//   npm run voice:generate -- --prune          also delete clips no longer in the question bank
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { narrationTexts } from '../dist/narration.js';

const defaultOut = fileURLToPath(new URL('../dist/audio/', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function voiceClips(questions) {
  return [...new Set(questions.flatMap(narrationTexts))];
}

export const clipFile = (text, { model, voice, format }) =>
  createHash('sha256').update([model, voice, format, text].join('\n')).digest('hex').slice(0, 20) + '.mp3';

async function exists(file) {
  try { return (await stat(file)).size > 0; } catch { return false; }
}

async function synthesize(text, { fetchImpl, key, voice, model, format, language, sleep }) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${encodeURIComponent(format)}`;
  const body = { text, model_id: model, ...(language ? { language_code: language } : {}) };
  for (let attempt = 1; ; attempt++) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body)
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 5) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`ElevenLabs returned ${response.status}: ${detail}`);
    }
    await sleep((Number(response.headers?.get?.('retry-after')) || 2 * attempt) * 1000);
  }
}

export async function generateVoice({
  clips, env = process.env, fetchImpl = (...args) => fetch(...args), outDir = defaultOut,
  limit = Infinity, prune = false, dryRun = false, sleep = pause, log = console.log
}) {
  const settings = {
    model: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    voice: env.ELEVENLABS_VOICE_ID || '',
    format: env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
    language: env.ELEVENLABS_LANGUAGE || '',
    key: env.ELEVENLABS_API_KEY || '',
    fetchImpl, sleep
  };
  const chars = clips.reduce((n, text) => n + text.length, 0);
  if (dryRun) {
    log(`${clips.length} clips, ${chars} characters. Credit use depends on the model; check your ElevenLabs plan.`);
    return { total: clips.length, chars, created: 0, existing: 0, failed: 0 };
  }
  if (!settings.key || !settings.voice) throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your local .env first.');

  await mkdir(outDir, { recursive: true });
  const names = new Map(clips.map(text => [text, clipFile(text, settings)]));
  let created = 0, existing = 0, failed = 0;
  for (const [text, name] of names) {
    const target = path.join(outDir, name);
    if (await exists(target)) { existing++; continue; }
    if (created >= limit) continue;
    try {
      await writeFile(target, await synthesize(text, settings));
      created++;
      log(`created ${created}: ${text.slice(0, 60)}`);
    } catch (error) {
      failed++;
      log(`failed: ${text.slice(0, 60)} (${error.message})`);
      if (/ 401:| 402:| 403:/.test(error.message)) break; // key or plan problem: stop instead of repeating it
    }
  }

  const available = {};
  for (const [text, name] of names) if (await exists(path.join(outDir, name))) available[text] = name;
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ version: 1, model: settings.model, format: settings.format, clips: available }, null, 1));
  if (prune) {
    const keep = new Set([...names.values(), 'manifest.json']);
    for (const file of await readdir(outDir)) if (file.endsWith('.mp3') && !keep.has(file)) await rm(path.join(outDir, file));
  }
  log(`${Object.keys(available).length}/${clips.length} clips ready (${created} new, ${existing} already present, ${failed} failed).`);
  return { total: clips.length, chars, created, existing, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const args = process.argv.slice(2);
  const limit = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
  const { questions } = await import('../backend/questions.js');
  try {
    const result = await generateVoice({ clips: voiceClips(questions), limit, prune: args.includes('--prune'), dryRun: args.includes('--dry-run') });
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
