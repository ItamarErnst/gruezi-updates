/**
 * How many sentences to introduce today — the web twin of `NewCardPace.kt`.
 *
 * The app used to introduce exactly one a day, which is right for a deck with
 * history behind it and wrong on the first day of a fresh one: one new sentence
 * plus endless review meant reviewing that single sentence over and over, in both
 * directions, because it was the only card the scheduler had.
 *
 * Five a day was rejected before as a standing rate — at 79 sentences a level it
 * burns a level in a fortnight. The two answers belong to different moments, so
 * the rate tapers instead.
 */

/** Per day while the deck is still too small to rotate. */
export const SEED_RATE = 5;

/** Per day once it isn't. */
export const SETTLED_RATE = 2;

/** Seen cards at which the deck counts as established — two full rotation passes. */
export const ESTABLISHED_DECK = 20;

/** Below this a rotation is just the same card again; see `shouldForceNew`. */
export const MIN_ROTATION = 5;

/** `prefs.newPerDay` uses this to mean "taper it for me". */
export const AUTO = 0;

/**
 * Today's quota. `configured` is the user's setting, where `AUTO` defers to the
 * taper and anything else is taken literally — someone who asks for ten a day has
 * decided to burn through a level, and that is their call.
 */
export function perDay(seenCards, configured = AUTO) {
  if (configured !== AUTO) return configured;
  return seenCards < ESTABLISHED_DECK ? SEED_RATE : SETTLED_RATE;
}

/**
 * Whether to introduce a sentence even though today's quota is spent.
 *
 * Only when nothing is due and the deck is still tiny. This is the guard that
 * kills the day-one loop: with the quota alone, someone who finishes their five
 * and keeps going gets those same five in a circle. It cannot affect an
 * established deck, where there is always something due or a rotation worth having.
 */
export function shouldForceNew(seenCards, nothingDue) {
  return nothingDue && seenCards < MIN_ROTATION;
}
