// Plays pre-generated voice clips from ./audio/ (created by `npm run voice:generate`).
// speak() resolves false when the clips cannot be used, so the caller can fall back to the browser voice.
export const LETTERS = 'ABCD';
 
// The phrases that make up one spoken question, in reading order. The generator and the player share this.
export const narrationTexts = q => [q.prompt, ...q.options.flatMap((o, i) => ['Option ' + LETTERS[i], o])];
 
// A tiny silent WAV, played inside the click so Safari lets us keep playing after the async fetches.
function silence() {
  const n = 80, v = new DataView(new ArrayBuffer(44 + n));
  const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + n, true); text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  text(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return new Blob([v.buffer], { type: 'audio/wav' });
}
 
export function createNarrator({
  fetchImpl = (...args) => globalThis.fetch(...args),
  AudioImpl = globalThis.Audio,
  makeUrl = blob => URL.createObjectURL(blob),
  base = './audio/',
  gapMs = 180
} = {}) {
  let clips = null, player = null, silenceUrl = null, run = 0;
  const blobUrls = new Map();
 
  async function manifest() {
    if (clips) return clips;
    try {
      const response = await fetchImpl(base + 'manifest.json');
      if (response.ok) {
        const data = await response.json();
        if (data && data.clips && typeof data.clips === 'object') clips = data.clips;
      }
    } catch { /* no manifest: caller falls back to the browser voice */ }
    return clips;
  }
 
  async function clipUrl(file) {
    if (blobUrls.has(file)) return blobUrls.get(file);
    const response = await fetchImpl(base + file);
    if (!response.ok) throw new Error('Clip unavailable');
    const url = makeUrl(await response.blob());
    blobUrls.set(file, url);
    return url;
  }
 
  function play(src) {
    return new Promise(resolve => {
      player.onended = () => resolve(true);
      player.onerror = () => resolve(false);
      player.src = src;
      try { player.play()?.catch?.(() => resolve(false)); } catch { resolve(false); }
    });
  }
 
  function halt() {
    if (!player) return;
    const pending = player.onended;
    player.onended = null; player.onerror = null;
    try { player.pause(); } catch { /* element already idle */ }
    pending?.(); // lets a waiting speak() loop notice it was cancelled
  }
 
  function stop() { run++; halt(); }
 
  async function speak(q, { onend } = {}) {
    if (typeof AudioImpl !== 'function') return false;
    stop();
    const mine = run;
    player ??= new AudioImpl();
    try { // runs synchronously inside the click, which unlocks audio on iOS Safari
      silenceUrl ??= makeUrl(silence());
      player.src = silenceUrl;
      player.play()?.catch?.(() => {});
    } catch { /* unlock is best effort */ }
 
    const map = await manifest();
    if (mine !== run) return true;
    if (!map) return false;
    const files = narrationTexts(q).map(text => map[text]);
    if (files.some(file => typeof file !== 'string' || !/^[a-f0-9]+\.mp3$/.test(file))) return false;
    let urls;
    try { urls = await Promise.all(files.map(clipUrl)); } catch { return false; }
    if (mine !== run) return true;
 
    for (let i = 0; i < urls.length; i++) {
      const ok = await play(urls[i]);
      if (mine !== run) return true;
      if (!ok) { if (i === 0) return false; break; }
      if (i < urls.length - 1 && gapMs) await new Promise(resolve => setTimeout(resolve, gapMs));
      if (mine !== run) return true;
    }
    onend?.();
    return true;
  }
 
  return { speak, stop, supported: typeof AudioImpl === 'function' };
}