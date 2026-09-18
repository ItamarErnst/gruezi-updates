/**
 * Everything that has to survive a reload: review schedules, the review
 * rotation, the daily goal and streak, the settings, and hand-added entries.
 *
 * On Android these are four files in `filesDir`; here they're four keys in
 * `localStorage`, under the same shapes so the two stay comparable. Every read
 * is defensive — a browser can refuse storage entirely (private mode, blocked
 * site data), and the app has to keep working rather than throw on boot.
 */

import {
  Grade, Mode, Phase, newCard, grade as gradeCard, isDue,
  nowMinute, dayStartMinute, epochDay, previewLabels,
} from './srs.js';

const KEYS = {
  review: 'gruezi.review',
  cycle: 'gruezi.cycle',
  progress: 'gruezi.progress',
  prefs: 'gruezi.prefs',
  user: 'gruezi.user',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota or storage denied — the session still works, it just won't
    // be there next time. Failing loudly here would be worse.
  }
}

// --- review schedules ----------------------------------------------------

/**
 * Schedules per `"<id>|<MODE>"`, mirroring `ReviewStore.kt`.
 */
export class ReviewStore {
  constructor() {
    const stored = read(KEYS.review, null);
    this.cards = (stored && stored.cards) || {};
  }

  static key(id, mode) {
    return `${id}|${mode}`;
  }

  save() {
    write(KEYS.review, { v: 2, cards: this.cards });
  }

  card(id, mode) {
    return this.cards[ReviewStore.key(id, mode)] || newCard();
  }

  /** Every practised mode of this card. */
  modesOf(id) {
    return [Mode.READ, Mode.RECALL]
      .map((m) => this.cards[ReviewStore.key(id, m)])
      .filter(Boolean);
  }

  isSeen(id) {
    return this.modesOf(id).length > 0;
  }

  /** Still being worked on: not graduated, lapsed, or on a very short interval. */
  isHard(id) {
    return this.modesOf(id).some(
      (c) => c.phase !== Phase.REVIEW || c.lapses > 0 || (c.intervalDays >= 1 && c.intervalDays <= 2),
    );
  }

  /** Graduated in every practised mode, on a week-plus interval. */
  isMastered(id) {
    const cards = this.modesOf(id);
    return cards.length > 0 && cards.every((c) => c.phase === Phase.REVIEW && c.intervalDays >= 7);
  }

  /** Every due slot among `ids`, most overdue first. */
  dueQueue(ids, now = nowMinute()) {
    const live = new Set(ids);
    const out = [];
    for (const [key, card] of Object.entries(this.cards)) {
      const sep = key.lastIndexOf('|');
      const id = key.slice(0, sep);
      const mode = key.slice(sep + 1);
      if (!live.has(id) || !isDue(card, now)) continue;
      out.push({ id, mode, card });
    }
    return out.sort((a, b) => a.card.due - b.card.due);
  }

  dueCount(ids, now = nowMinute()) {
    return this.dueQueue(ids, now).length;
  }

  previewLabels(id, mode, now = nowMinute()) {
    return previewLabels(this.card(id, mode), now, dayStartMinute());
  }

  grade(id, mode, g, now = nowMinute()) {
    const next = gradeCard(this.card(id, mode), g, now, dayStartMinute());
    this.cards[ReviewStore.key(id, mode)] = next;
    this.save();
    return next;
  }

  /** Drop every schedule for this card — it becomes unseen again. */
  forget(id) {
    for (const m of [Mode.READ, Mode.RECALL]) delete this.cards[ReviewStore.key(id, m)];
    this.save();
  }
}

// --- the review rotation -------------------------------------------------

/**
 * The free-practice rotation, ported from `ReviewCycle.kt`.
 *
 * A cycle covers every card twice — once in a random mode, once in the
 * opposite — and nothing repeats until the whole cycle is spent, so a sentence
 * never turns up right after its own flip side.
 */
export class ReviewCycle {
  constructor() {
    const s = read(KEYS.cycle, null) || {};
    this.passA = s.a || [];
    this.passB = s.b || [];
    this.served = new Set(s.served || []);
  }

  save() {
    write(KEYS.cycle, { a: this.passA, b: this.passB, served: [...this.served] });
  }

  reset() {
    this.passA = [];
    this.passB = [];
    this.served.clear();
    this.save();
  }

  static other(mode) {
    return mode === Mode.READ ? Mode.RECALL : Mode.READ;
  }

  static randomMode() {
    return Math.random() < 0.5 ? Mode.READ : Mode.RECALL;
  }

  /** The next slot to practise, drawn from `ids`. Null only when `ids` is empty. */
  next(ids, weight = () => 1) {
    if (ids.length === 0) {
      this.reset();
      return null;
    }
    this.reconcile(ids, weight);
    const slot = this.passA.shift() || this.passB.shift() || null;
    if (slot) this.served.add(slot.id);
    // Cycle spent — start clean so the next call deals a fresh one.
    if (this.passA.length === 0 && this.passB.length === 0) this.served.clear();
    this.save();
    return slot;
  }

  reconcile(ids, weight) {
    const live = new Set(ids);
    this.passA = this.passA.filter((s) => live.has(s.id));
    this.passB = this.passB.filter((s) => live.has(s.id));
    for (const id of [...this.served]) if (!live.has(id)) this.served.delete(id);

    if (this.passA.length === 0 && this.passB.length === 0) {
      this.rebuild(ids, weight);
      return;
    }

    // Cards that turned up mid-cycle join in, unless they've already had a turn.
    const queued = new Set([...this.passA, ...this.passB].map((s) => s.id));
    for (const id of ids) {
      if (queued.has(id) || this.served.has(id)) continue;
      const first = ReviewCycle.randomMode();
      if (this.passA.length > 0) {
        insertRandom(this.passA, { id, mode: first });
        insertRandom(this.passB, { id, mode: ReviewCycle.other(first) });
      } else {
        // Already on the flip pass — one turn now, the flip comes next cycle.
        insertRandom(this.passB, { id, mode: first });
      }
    }
  }

  /** Deal a whole new cycle: weighted-shuffled pass A, mirrored into pass B. */
  rebuild(ids, weight) {
    this.served.clear();
    const order = [...ids].sort(
      (a, b) => Math.max(1, weight(b)) * Math.random() - Math.max(1, weight(a)) * Math.random(),
    );
    this.passA = [];
    this.passB = [];
    for (const id of order) {
      const first = ReviewCycle.randomMode();
      this.passA.push({ id, mode: first });
      this.passB.push({ id, mode: ReviewCycle.other(first) });
    }
    shuffle(this.passB);   // the flip pass gets its own order
  }
}

function insertRandom(list, item) {
  list.splice(Math.floor(Math.random() * (list.length + 1)), 0, item);
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

// --- the daily goal and streak -------------------------------------------

export const REVIEW_GOAL = 5;

/** Mirrors `ProgressStore.kt`: today's two goals, plus the days already done. */
export class ProgressStore {
  constructor() {
    const s = read(KEYS.progress, null) || {};
    this.days = new Set(s.days || []);
    this.day = s.day || 0;
    this.newDone = !!s.newDone;
    this.reviews = s.reviews || 0;
    this.graded = new Set(s.graded || []);
    this.completedLessons = new Set(s.completedLessons || []);
  }

  save() {
    write(KEYS.progress, {
      days: [...this.days],
      day: this.day,
      newDone: this.newDone,
      reviews: this.reviews,
      graded: [...this.graded],
      completedLessons: [...this.completedLessons],
    });
  }

  /** Roll the per-day counters over when the date changes. */
  roll(today = epochDay()) {
    if (this.day !== today) {
      this.day = today;
      this.newDone = false;
      this.reviews = 0;
      this.graded.clear();
    }
  }

  newSentenceDone(today = epochDay()) {
    this.roll(today);
    return this.newDone;
  }

  reviewsDone(today = epochDay()) {
    this.roll(today);
    return this.reviews;
  }

  isComplete(day) {
    return this.days.has(day);
  }

  markGraded(id, today = epochDay()) {
    this.roll(today);
    this.graded.add(id);
    this.save();
  }

  /** Mark today's new sentence done. True if this completed the day. */
  markNewSentence(today = epochDay()) {
    this.roll(today);
    this.newDone = true;
    return this.finish(today);
  }

  /** Record one review. True if this completed the day. */
  addReview(today = epochDay()) {
    this.roll(today);
    if (this.reviews < REVIEW_GOAL) this.reviews++;
    return this.finish(today);
  }

  finish(today) {
    const complete = this.newDone && this.reviews >= REVIEW_GOAL;
    const justNow = complete && !this.days.has(today);
    if (complete) this.days.add(today);
    this.save();
    return justNow;
  }

  /** Consecutive completed days ending today (or yesterday if today isn't done). */
  streak(today = epochDay()) {
    let d = this.days.has(today) ? today : today - 1;
    let n = 0;
    while (this.days.has(d)) {
      n++;
      d--;
    }
    return n;
  }

  completeLesson(id) {
    this.completedLessons.add(id);
    this.save();
  }
}

// --- settings ------------------------------------------------------------

const PREF_DEFAULTS = {
  level: 'A1',
  phonetics: true,
  audio: false,
  theme: 'system',   // system | light | dark
};

export class Prefs {
  constructor() {
    this.values = { ...PREF_DEFAULTS, ...read(KEYS.prefs, {}) };
  }

  get(name) {
    return this.values[name];
  }

  set(name, value) {
    this.values[name] = value;
    write(KEYS.prefs, this.values);
  }
}

// --- hand-added entries --------------------------------------------------

/** Entries added through "+ Add", merged with the bundled set at load. */
export class UserEntries {
  constructor() {
    this.entries = read(KEYS.user, []);
  }

  all() {
    return this.entries;
  }

  add(entry) {
    const stored = { ...entry, id: `u${Date.now()}`, userAdded: true };
    this.entries.push(stored);
    write(KEYS.user, this.entries);
    return stored;
  }

  remove(id) {
    this.entries = this.entries.filter((e) => e.id !== id);
    write(KEYS.user, this.entries);
  }
}

export { Grade, Mode, Phase, epochDay, nowMinute };
