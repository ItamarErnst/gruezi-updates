/**
 * Taking a deck out of the browser, and putting it back — the web twin of
 * `Backup.kt`.
 *
 * This matters more here than on the phone. Everything lives in `localStorage`,
 * which means a cleared site-data setting, a private window, or simply opening the
 * link in a different browser starts a fresh deck, with no warning and nothing to
 * recover from. A file is the only durable copy there is.
 *
 * The format is deliberately the same shape as the Android one: a `format`, the
 * `channel` it came from, and the state under `state`. It is not byte-identical —
 * the phone stores three JSON files where the browser has five keys — so the two
 * are not interchangeable, and the channel stamp is what stops someone trying.
 */

import { CHANNELS, isChannel } from './lang.js';

export const FORMAT_VERSION = 1;

/** The namespaced keys one language's deck occupies. */
const NAMES = ['review', 'cycle', 'progress', 'prefs', 'user'];

function keyFor(channel, name) {
  return `gruezi.${channel}.${name}`;
}

/** Everything stored for `channel`, as pretty-printed JSON. */
export function exportJson(channel) {
  const state = {};
  for (const name of NAMES) {
    try {
      const raw = localStorage.getItem(keyFor(channel, name));
      if (raw === null) continue;
      // Parsed rather than embedded as a string, so a corrupt key fails here —
      // while writing the backup — instead of on the restore months later.
      state[name] = JSON.parse(raw);
    } catch {
      // Unreadable or unparseable: leave it out rather than poison the file.
    }
  }
  return JSON.stringify({
    format: FORMAT_VERSION,
    channel,
    platform: 'web',
    exportedAt: Date.now(),
    state,
  }, null, 2);
}

/** A dated file name, named for the language it came from. */
export function fileName(channel) {
  const day = new Date().toISOString().slice(0, 10);
  return `${channel}-web-backup-${day}.json`;
}

/**
 * Replace `channel`'s deck with `text`.
 *
 * Returns `{ ok: true, keys }` or `{ ok: false, reason }`. Everything is parsed
 * and checked before a single key is written, so a bad file leaves the deck alone.
 */
export function importJson(channel, text) {
  let root;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, reason: "that doesn't look like a backup file" };
  }
  if (!root || typeof root !== 'object' || !root.state || !root.format) {
    return { ok: false, reason: "that doesn't look like a backup file" };
  }
  if (root.format > FORMAT_VERSION) {
    return { ok: false, reason: 'that backup was written by a newer version' };
  }
  if (root.channel && !isChannel(root.channel)) {
    return { ok: false, reason: `unknown language "${root.channel}"` };
  }
  if (root.channel && root.channel !== channel) {
    return {
      ok: false,
      reason: `that backup is ${root.channel}, and you're in ${channel}`
        + ' — every language shares the same sentence ids, so it would claim'
        + " sentences you haven't seen",
    };
  }
  if (root.platform && root.platform !== 'web') {
    return {
      ok: false,
      reason: `that backup came from the ${root.platform} app, which stores its deck differently`,
    };
  }

  // Stage first. A half-applied restore would be worse than a refused one.
  const staged = [];
  for (const name of NAMES) {
    if (!(name in root.state)) continue;
    staged.push([keyFor(channel, name), JSON.stringify(root.state[name])]);
  }
  if (staged.length === 0) return { ok: false, reason: 'the backup has no progress in it' };

  try {
    for (const [key, value] of staged) localStorage.setItem(key, value);
  } catch {
    return { ok: false, reason: 'this browser refused to store it' };
  }
  return { ok: true, keys: staged.length };
}

/** Hand the file to the browser's download machinery. */
export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick; revoking immediately can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for a file and hand back its text. Resolves to null if cancelled. */
export function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      file.text().then(resolve).catch(() => resolve(null));
    });
    input.click();
  });
}

export { CHANNELS };
