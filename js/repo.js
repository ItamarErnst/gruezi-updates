/**
 * The content layer: loads the three JSON files and answers the questions the
 * screens ask of them. Ported from `SentenceRepository.kt`.
 *
 * The JSON under `web/data/<channel>/` is copied verbatim from each language
 * branch's `app/src/main/assets/` — the Android assets stay the single source of
 * truth, so a content edit only ever happens in one place. One folder per
 * channel, because unlike the phone the web app ships every language at once.
 */

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export class Repo {
  constructor({ sentences, bridges, lessons }, userEntries) {
    this.bundled = sentences;
    this.bridges = bridges;
    this.lessons = lessons;
    this.userEntries = userEntries;
  }

  static async load(userEntries, channel) {
    const [sentences, bridges, lessons] = await Promise.all(
      ['sentences', 'bridges', 'lessons'].map((n) =>
        fetch(`data/${channel}/${n}.json`).then((r) => {
          if (!r.ok) throw new Error(`could not load ${channel}/${n}.json (${r.status})`);
          return r.json();
        }),
      ),
    );
    return new Repo({ sentences, bridges, lessons }, userEntries);
  }

  all() {
    return [...this.bundled, ...this.userEntries.all()];
  }

  byId(id) {
    return this.all().find((s) => s.id === id) || null;
  }

  levelIndex(level) {
    return LEVELS.indexOf(level);
  }

  /**
   * Where new sentences come from: the current level only. Testing out of B1
   * into B2 should hand you B2 material, not the A1 content you skipped.
   */
  newPool(level) {
    return this.all().filter((s) => s.level === level);
  }

  /**
   * Where reviews come from: the current level and anything above it. Cards
   * from levels you've left behind retire rather than diluting the practice.
   */
  reviewPool(level) {
    const min = this.levelIndex(level);
    return this.all().filter((s) => this.levelIndex(s.level) >= min);
  }

  /**
   * The "sentence of the day" — one you haven't met, stable for a given date.
   * Once the level is exhausted it falls back to a date-rotated pick, so the
   * card is never blank.
   */
  daily(level, seen, day) {
    const atLevel = this.newPool(level);
    if (atLevel.length === 0) return null;
    const fresh = atLevel.filter((s) => !seen.has(s.id));
    const pool = fresh.length > 0 ? fresh : atLevel;
    return pool[((day % pool.length) + pool.length) % pool.length];
  }

  bridge(id) {
    return this.bridges.find((b) => b.id === id) || null;
  }

  bridgesFor(sentence) {
    return (sentence.bridges || []).map((id) => this.bridge(id)).filter(Boolean);
  }

  lesson(id) {
    return this.lessons.find((l) => l.id === id) || null;
  }
}
