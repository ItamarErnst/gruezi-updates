/**
 * The SM-2 scheduler, ported from `Srs.kt`.
 *
 * This is deliberately a line-by-line port rather than a fresh design: the
 * Android app and the web app must schedule a card identically, or the same
 * deck would behave differently depending on where you opened it. If you change
 * a constant here, change it there too — `app/src/test/java/.../SrsTest.kt` is
 * the spec both sides are held to.
 */

export const Grade = Object.freeze({
  AGAIN: 'AGAIN',
  HARD: 'HARD',
  GOOD: 'GOOD',
  EASY: 'EASY',
});

export const Mode = Object.freeze({ READ: 'READ', RECALL: 'RECALL' });

export const Phase = Object.freeze({
  LEARNING: 'LEARNING',
  REVIEW: 'REVIEW',
  RELEARNING: 'RELEARNING',
});

/** Anki's default deck settings. Ease is per-mille so the state stays integral. */
export const STARTING_EASE = 2500;
export const MIN_EASE = 1300;
export const LEARNING_STEPS = [1, 10];      // minutes
export const RELEARNING_STEPS = [10];       // minutes
export const GRADUATING_INTERVAL = 1;       // days
export const EASY_INTERVAL = 4;             // days
export const HARD_MULTIPLIER = 1.2;
export const EASY_BONUS = 1.3;
export const LAPSE_MULTIPLIER = 0.0;
export const MAX_INTERVAL = 36500;

export const MINUTES_PER_DAY = 1440;

/** A fresh, never-practised card. */
export function newCard() {
  return {
    phase: Phase.LEARNING,
    step: 0,
    ease: STARTING_EASE,
    intervalDays: 0,
    due: 0,
    reps: 0,
    lapses: 0,
  };
}

export function isDue(card, nowMinute) {
  return card.due <= nowMinute;
}

/** Current time as an epoch minute. */
export function nowMinute() {
  return Math.floor(Date.now() / 60000);
}

/** Epoch minute of local midnight today (or for a given Date). */
export function dayStartMinute(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(d.getTime() / 60000);
}

/** Local epoch *day*, the unit the streak and daily goal are counted in. */
export function epochDay(date = new Date()) {
  return Math.floor(dayStartMinute(date) / MINUTES_PER_DAY);
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const adjustEase = (ease, delta) => Math.max(MIN_EASE, ease + delta);
const cap = (days) => clamp(days, 1, MAX_INTERVAL);

/**
 * Anki's interval fuzz: ±5% from three days out, so cards learned together
 * don't stay clumped. `rand` is injectable so tests can pin it.
 */
function fuzzed(days, rand) {
  if (days < 3) return days;
  const spread = Math.max(1, Math.round(days * 0.05));
  const delta = Math.floor(rand() * (2 * spread + 1)) - spread;
  return clamp(days + delta, 1, MAX_INTERVAL);
}

/**
 * Grade `card` and return its new state. Never mutates the input.
 *
 * `now` is an epoch minute; `dayStart` the epoch minute of today's midnight, so
 * reviews fall due at the start of a day and learning steps to the minute.
 */
export function grade(card, g, now = nowMinute(), dayStart = dayStartMinute(), rand = Math.random) {
  switch (card.phase) {
    case Phase.LEARNING:
      return gradeLearning(card, g, now, dayStart, rand);
    case Phase.RELEARNING:
      return gradeRelearning(card, g, now, dayStart, rand);
    default:
      return gradeReview(card, g, now, dayStart, rand);
  }
}

function graduate(card, interval, reps, dayStart, rand) {
  return {
    ...card,
    phase: Phase.REVIEW,
    step: 0,
    intervalDays: interval,
    reps,
    due: dayStart + fuzzed(interval, rand) * MINUTES_PER_DAY,
  };
}

function gradeLearning(card, g, now, dayStart, rand) {
  const reps = card.reps + 1;
  switch (g) {
    case Grade.AGAIN:
      // Back to the first step — it hasn't stuck yet.
      return { ...card, step: 0, reps, due: now + LEARNING_STEPS[0] };
    case Grade.HARD: {
      // Hold position and try the same step again shortly.
      const i = clamp(card.step, 0, LEARNING_STEPS.length - 1);
      return { ...card, reps, due: now + LEARNING_STEPS[i] };
    }
    case Grade.GOOD: {
      const next = card.step + 1;
      if (next >= LEARNING_STEPS.length) {
        return graduate(card, GRADUATING_INTERVAL, reps, dayStart, rand);
      }
      return { ...card, step: next, reps, due: now + LEARNING_STEPS[next] };
    }
    default:
      // Straight out of learning, onto the longer easy interval.
      return graduate(card, EASY_INTERVAL, reps, dayStart, rand);
  }
}

function gradeRelearning(card, g, now, dayStart, rand) {
  const reps = card.reps + 1;
  if (g === Grade.AGAIN) {
    return { ...card, step: 0, reps, due: now + RELEARNING_STEPS[0] };
  }
  if (g === Grade.HARD) {
    const i = clamp(card.step, 0, RELEARNING_STEPS.length - 1);
    return { ...card, reps, due: now + RELEARNING_STEPS[i] };
  }
  const next = card.step + 1;
  if (g === Grade.EASY || next >= RELEARNING_STEPS.length) {
    // The post-lapse interval was set when it lapsed; this just puts the card
    // back on the day scale.
    const interval = Math.max(GRADUATING_INTERVAL, card.intervalDays);
    return {
      ...card,
      phase: Phase.REVIEW,
      step: 0,
      reps,
      intervalDays: interval,
      due: dayStart + fuzzed(interval, rand) * MINUTES_PER_DAY,
    };
  }
  return { ...card, step: next, reps, due: now + RELEARNING_STEPS[next] };
}

function gradeReview(card, g, now, dayStart, rand) {
  const reps = card.reps + 1;
  const current = Math.max(1, card.intervalDays);

  if (g === Grade.AGAIN) {
    // A lapse: lose ease, collapse the interval, drop into relearning.
    return {
      ...card,
      phase: Phase.RELEARNING,
      step: 0,
      ease: adjustEase(card.ease, -200),
      intervalDays: cap(Math.max(1, Math.round(current * LAPSE_MULTIPLIER))),
      reps,
      lapses: card.lapses + 1,
      due: now + RELEARNING_STEPS[0],
    };
  }

  let ease = card.ease;
  if (g === Grade.HARD) ease = adjustEase(ease, -150);
  if (g === Grade.EASY) ease = adjustEase(ease, +150);
  const easeFactor = ease / 1000;

  let raw;
  if (g === Grade.HARD) raw = Math.round(current * HARD_MULTIPLIER);
  else if (g === Grade.GOOD) raw = Math.round(current * easeFactor);
  else raw = Math.round(current * easeFactor * EASY_BONUS);

  // A pass always moves the card at least one day further out.
  const interval = cap(Math.max(raw, current + 1));
  return {
    ...card,
    ease,
    intervalDays: interval,
    reps,
    due: dayStart + fuzzed(interval, rand) * MINUTES_PER_DAY,
  };
}

/** "3d", "2wk", "5mo", "1.4y" — Anki's compact interval labels. */
export function formatDays(days) {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}wk`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** "<1m", "10m", "2h" — for the intra-session learning steps. */
export function formatMinutes(minutes) {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return formatDays(Math.floor(minutes / 1440));
}

/**
 * What each button would do to this card, as a label for the UI.
 * Uses a fixed pseudo-random source so the preview doesn't flicker between
 * renders — the real grade re-rolls the fuzz.
 */
export function previewLabels(card, now = nowMinute(), dayStart = dayStartMinute()) {
  const stable = () => 0.5;
  const out = {};
  for (const g of Object.values(Grade)) {
    const next = grade(card, g, now, dayStart, stable);
    out[g] = next.phase === Phase.REVIEW
      ? formatDays(next.intervalDays)
      : formatMinutes(Math.max(1, next.due - now));
  }
  return out;
}
