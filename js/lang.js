/**
 * Every string that depends on which language is being taught — the web twin of
 * `Lang.kt`, and the reason the web app can hold all four at once.
 *
 * On Android a fork is a branch and `Lang.kt` is the one code file it owns. The
 * web has no forks: it ships every language from one deploy, so the same strings
 * become a table keyed by channel. The channel names match the Android update
 * channels (`gruezi`, `hoi`, `ciao`, `shalom`) so a phone and a browser talking
 * about the same language agree on what to call it.
 *
 * Keep the keys in step with `Lang.kt`. Anything the learner can read belongs
 * here; anything structural does not.
 */

/** Shared by every language: the method explanation and the grade buttons. */
const COMMON = {
  gradeQuestion: 'How well did you know it?',
  gradeHard: 'Hard',
  gradeMedium: 'Medium',
  gradeEasy: 'Easy',
  /** The badge on a sentence that hasn't had a native read. */
  unverifiedBadge: 'Unchecked',
  methodTitle: 'How this works',
  // No SM-2, no ease factors. This has to answer one question — what do the
  // three buttons do? — because the buttons no longer answer it themselves.
  methodParagraphs: [
    "You won't get through this by seeing every sentence every day. Each one comes "
      + 'back on its own schedule, and that schedule is built from the only thing '
      + 'you tell it — how the sentence felt when you saw it.',
    '**Easy** — you had it straight away. The sentence goes away for much longer '
      + 'than last time.',
    '**Medium** — you worked it out. It comes back later than last time, and that '
      + 'gap keeps stretching each time you get it again.',
    "**Hard** — you hesitated, or you didn't have it. It comes back once more in a "
      + 'few minutes, and its gap is halved rather than thrown away.',
    "That's the whole trick: what you find difficult comes round often, and what "
      + 'you know drifts out to weeks and then months. Answer honestly and your '
      + "time goes where it's actually needed — being generous with Easy only "
      + "means meeting the sentence again on the day you've forgotten it.",
  ],
};

export const LANGUAGES = {
  gruezi: {
    ...COMMON,
    channel: 'gruezi',
    appName: 'Grüezi',
    /** The language's own name for itself, used wherever the text is labelled. */
    target: 'Züritüütsch',
    /** For prose: "under the Swiss sentence". */
    targetAdjective: 'Swiss',
    /** What to call it in the picker, where every option sits side by side. */
    pickerName: 'Swiss German',
    pickerNote: 'Zürich dialect — the one Itamar is learning',
    flag: '🇨🇭',
    dir: 'ltr',
    bridgesTitle: 'Bridges',
    bridgesBlurb: 'One rule, many words. Read the trick, then build each word '
      + 'yourself before you reveal it.',
    bridgesBack: 'All bridges',
    phoneticsLabel: 'Pronunciation',
    phoneticsSettingTitle: 'Show phonetics',
    phoneticsSettingSubtitle: 'An English-style respelling under the Swiss '
      + 'sentence — CAPS is the stressed syllable.',
  },

  hoi: {
    ...COMMON,
    channel: 'hoi',
    appName: 'Hoi',
    target: 'Dutch',
    targetAdjective: 'Dutch',
    pickerName: 'Dutch',
    pickerNote: "English's closest big relative — the rules pay off fastest here",
    flag: '🇳🇱',
    dir: 'ltr',
    bridgesTitle: 'Bridges',
    bridgesBlurb: "One rule, many words. Dutch is English's closest big relative, "
      + 'so each of these hands you dozens at once. Read the trick, then build '
      + 'each word yourself before you reveal it.',
    bridgesBack: 'All bridges',
    phoneticsLabel: 'Pronunciation',
    phoneticsSettingTitle: 'Show pronunciation',
    phoneticsSettingSubtitle: 'An English-style respelling under the Dutch '
      + 'sentence — CAPS is the stressed syllable.',
  },

  ciao: {
    ...COMMON,
    channel: 'ciao',
    appName: 'Ciao',
    target: 'Italian',
    targetAdjective: 'Italian',
    pickerName: 'Italian',
    pickerNote: 'A huge shared Latin vocabulary to borrow from',
    flag: '🇮🇹',
    dir: 'ltr',
    bridgesTitle: 'Bridges',
    bridgesBlurb: 'One rule, many words. Italian and English share an enormous '
      + 'Latin vocabulary — read the trick, then build each word yourself before '
      + 'you reveal it.',
    bridgesBack: 'All bridges',
    phoneticsLabel: 'Pronunciation',
    phoneticsSettingTitle: 'Show pronunciation',
    phoneticsSettingSubtitle: 'An English-style respelling under the Italian '
      + 'sentence — CAPS is the stressed syllable.',
  },

  shalom: {
    ...COMMON,
    channel: 'shalom',
    appName: 'Shalom',
    target: 'Hebrew',
    targetAdjective: 'Hebrew',
    pickerName: 'Hebrew',
    pickerNote: 'No shared vocabulary to lean on, so it teaches the alphabet first',
    flag: '🇮🇱',
    // The only right-to-left one. The shell sets `dir` from this, so the sentence
    // itself reads correctly without the English chrome flipping with it.
    dir: 'rtl',
    // Hebrew shares no vocabulary with English, so cognate rules have nothing to
    // work on — that fork teaches the alphabet and the attaching words instead.
    bridgesTitle: 'Basics',
    bridgesBlurb: 'The alphabet, and the little words that attach to build '
      + 'everything else. Read the idea, then try each one yourself before '
      + 'revealing it.',
    bridgesBack: 'All basics',
    phoneticsLabel: 'Transliteration',
    phoneticsSettingTitle: 'Show transliteration',
    phoneticsSettingSubtitle: 'The Hebrew spelled out in English letters, so you '
      + 'can say it before you can read it.',
  },
};

/** Channels in the order the picker offers them. */
export const CHANNELS = ['gruezi', 'hoi', 'ciao', 'shalom'];

/** The default when nothing has been chosen — this started as a Swiss app. */
export const DEFAULT_CHANNEL = 'gruezi';

export function isChannel(name) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, name);
}

/** The strings for `channel`, falling back to the default rather than throwing. */
export function langFor(channel) {
  return LANGUAGES[isChannel(channel) ? channel : DEFAULT_CHANNEL];
}
