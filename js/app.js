/**
 * The shell — and, unlike the phone builds, the shell for all four languages.
 *
 * On Android each language is its own APK off its own branch. Here they share one
 * deploy: the learner picks a language on first run, that choice selects both the
 * content folder and the storage namespace, and switching later is a reload rather
 * than an install. Two languages can be learned side by side because their decks
 * never share a key.
 *
 * Renders one of three views into <main>, handles every click by delegation from
 * the root, and owns the dialogs (settings, streak, add entry, the celebrations).
 * There's no router: the tab and any open lesson/bridge are just state, and the
 * back button is wired to close whatever is open.
 */

import { Repo, LEVELS } from './repo.js';
import {
  ReviewStore, ReviewCycle, ProgressStore, Prefs, UserEntries,
  Grade, Mode, REVIEW_GOAL, epochDay,
  useChannel, readChannel, writeChannel,
} from './store.js';
import { CHANNELS, DEFAULT_CHANNEL, isChannel, langFor } from './lang.js';
import * as pace from './pace.js';
import * as backup from './backup.js';
import { DailyView } from './views/daily.js';
import { LearnView } from './views/learn.js';
import { BridgesView } from './views/bridges.js';
import {
  bubbleIcon, chunky, emphasised, esc, ghostButton, icon, iconButton, pill,
} from './ui.js';

/** The third tab's name comes from the language — Hebrew calls it "Basics". */
function tabsFor(lang) {
  return [
    { id: 'daily', label: 'Daily', icon: 'daily' },
    { id: 'learn', label: 'Learn', icon: 'learn' },
    { id: 'bridges', label: lang.bridgesTitle, icon: 'bridges' },
  ];
}

class App {
  constructor(repo, lang) {
    this.repo = repo;
    this.lang = lang;
    this.channel = lang.channel;
    this.reviews = new ReviewStore();
    this.cycle = new ReviewCycle();
    this.progress = new ProgressStore();
    this.prefs = new Prefs();
    this.tab = 'daily';

    const ctx = {
      repo,
      lang,
      pace,
      reviews: this.reviews,
      cycle: this.cycle,
      progress: this.progress,
      prefs: this.prefs,
      // No audio ships with the web build — the clips are ~1 MB of Android
      // assets and the voice is an approximation anyway. The hooks stay so
      // turning it on later is a build-script change, not a code change.
      hasAudio: () => false,
      refreshChrome: () => this.renderChrome(),
      celebrate: (kind, arg) => this.celebrate(kind, arg),
    };

    this.views = {
      daily: new DailyView(ctx),
      learn: new LearnView(ctx),
      bridges: new BridgesView(ctx),
    };

    this.root = document.getElementById('app');
    this.main = document.getElementById('main');
    this.applyTheme();
  }

  // --- theme -------------------------------------------------------------

  applyTheme() {
    const theme = this.prefs.get('theme');
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    // Keep the iOS status bar / Android chrome in step with the background.
    const dark = theme === 'dark'
      || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#141a17' : '#f7f6f2');
  }

  // --- rendering ---------------------------------------------------------

  render() {
    this.main.innerHTML = this.views[this.tab].render();
    this.renderChrome();
    this.main.scrollTop = 0;
  }

  /** The bits outside <main>: the streak count and the selected tab. */
  renderChrome() {
    const streak = this.progress.streak();
    document.getElementById('streak-count').textContent = String(streak);
    for (const btn of document.querySelectorAll('.navitem')) {
      if (btn.dataset.tab === this.tab) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  select(tab) {
    this.tab = tab;
    this.render();
  }

  // --- click handling ----------------------------------------------------

  handle(action, arg) {
    // Let the active view claim it first; it owns its own interactions.
    if (this.views[this.tab].handle(action, arg)) {
      this.render();
      return;
    }

    switch (action) {
      case 'select-tab':
        this.select(arg);
        break;
      case 'open-bridge':
        // Deep link from a sentence card's chip.
        this.views.bridges.open(arg);
        this.select('bridges');
        break;
      case 'open-streak':
        this.showStreak();
        break;
      case 'open-settings':
        this.showSettings();
        break;
      case 'add-entry':
        this.showAddEntry();
        break;
      case 'change-level':
        this.showLevelPicker();
        break;
      case 'open-method':
        this.showMethod();
        break;
      case 'export-data':
        this.exportData();
        break;
      case 'import-data':
        this.importData();
        break;
      case 'play-audio':
        // No clips in the web build yet; the hook is here for when there are.
        break;
      default:
        break;
    }
  }

  // --- dialogs -----------------------------------------------------------

  /** Open a <dialog> built from an HTML body, and clean it up on close. */
  openDialog(body, { onClose = null } = {}) {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<div class="dialog-body">${body}</div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (onClose) onClose();
    });
    // Tapping the backdrop closes it, the way a sheet should behave.
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.showModal();
    return dlg;
  }

  showSettings() {
    const p = this.prefs;
    const toggle = (name, title, subtitle) => `
      <div class="setting">
        <div class="grow">
          <strong>${esc(title)}</strong>
          <p class="small muted">${esc(subtitle)}</p>
        </div>
        <label class="switch">
          <input type="checkbox" data-pref="${esc(name)}" ${p.get(name) ? 'checked' : ''}>
          <span class="slider"></span>
          <span class="sr">${esc(title)}</span>
        </label>
      </div>`;

    const themes = ['system', 'light', 'dark'].map((t) =>
      `<button type="button" class="chip" data-theme-choice="${t}"
        aria-pressed="${p.get('theme') === t}">${t[0].toUpperCase()}${t.slice(1)}</button>`).join('');

    const lang = this.lang;
    const rate = p.get('newPerDay') ?? pace.AUTO;
    const rates = [pace.AUTO, 1, 2, 3, 5, 10].map((n) =>
      `<button type="button" class="chip" data-rate="${n}"
        aria-pressed="${rate === n}">${n === pace.AUTO ? 'Auto' : n}</button>`).join('');

    const languages = CHANNELS.map((ch) => {
      const l = langFor(ch);
      const current = ch === this.channel;
      return `<button type="button" class="chip" data-language="${ch}"
        aria-pressed="${current}">${l.flag} ${esc(l.pickerName)}</button>`;
    }).join('');

    const dlg = this.openDialog(`
      <h2>Settings</h2>
      ${toggle('phonetics', lang.phoneticsSettingTitle, lang.phoneticsSettingSubtitle)}
      <div>
        <p class="section-label" style="margin-bottom:8px">New sentences a day</p>
        <p class="small muted" style="margin-bottom:8px">${rate === pace.AUTO
          ? `Auto: ${pace.SEED_RATE} a day while your deck is small, then ${pace.SETTLED_RATE}.`
          : `${rate} a day, whatever the deck looks like.`}</p>
        <div class="chipset">${rates}</div>
      </div>
      <div>
        <p class="section-label" style="margin-bottom:8px">${esc(lang.methodTitle)}</p>
        <p class="small muted" style="margin-bottom:8px">What ${esc(lang.gradeHard)},
          ${esc(lang.gradeMedium)} and ${esc(lang.gradeEasy)} actually do to a sentence.</p>
        ${ghostButton('Read it', 'open-method', { icon: 'eye' })}
      </div>
      <div>
        <p class="section-label" style="margin-bottom:8px">Theme</p>
        <div class="chipset">${themes}</div>
      </div>
      <div>
        <p class="section-label" style="margin-bottom:8px">Language</p>
        <p class="small muted" style="margin-bottom:8px">Each keeps its own deck.
          Switching reloads the app; nothing is lost.</p>
        <div class="chipset">${languages}</div>
      </div>
      <div>
        <p class="section-label" style="margin-bottom:8px">Your deck</p>
        <p class="small muted" style="margin-bottom:8px">Progress is stored in this
          browser only. Clearing site data — or opening the link in a different
          browser — starts a fresh deck, so keep a copy.</p>
        <div class="row" style="gap:8px">
          ${ghostButton('Save a copy', 'export-data', { icon: 'download' })}
          ${ghostButton('Restore', 'import-data', { icon: 'undo' })}
        </div>
        <p class="small muted" id="backup-status" style="margin-top:8px"></p>
      </div>
      ${chunky('Done', 'close-dialog')}
    `);

    dlg.addEventListener('change', (e) => {
      const name = e.target.dataset.pref;
      if (name) {
        p.set(name, e.target.checked);
        this.render();
      }
    });
    dlg.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-theme-choice]');
      if (choice) {
        p.set('theme', choice.dataset.themeChoice);
        this.applyTheme();
        for (const c of dlg.querySelectorAll('[data-theme-choice]')) {
          c.setAttribute('aria-pressed', String(c.dataset.themeChoice === p.get('theme')));
        }
      }

      const rateBtn = e.target.closest('[data-rate]');
      if (rateBtn) {
        p.set('newPerDay', Number(rateBtn.dataset.rate));
        dlg.close();
        this.showSettings();     // redraw so the description matches the choice
        return;
      }

      const langBtn = e.target.closest('[data-language]');
      if (langBtn && langBtn.dataset.language !== this.channel) {
        writeChannel(langBtn.dataset.language);
        location.reload();
        return;
      }

      if (e.target.closest('[data-action="close-dialog"]')) dlg.close();
    });
  }

  /** "How this works" — the explanation that replaced the intervals on the buttons. */
  showMethod() {
    const paragraphs = this.lang.methodParagraphs
      .map((t) => `<p class="muted">${emphasised(t)}</p>`)
      .join('');
    this.openDialog(`
      <h2>${esc(this.lang.methodTitle)}</h2>
      ${paragraphs}
      ${chunky('Got it', 'close-dialog')}
    `).addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close-dialog"]')) e.currentTarget.close();
    });
  }

  exportData() {
    const status = document.getElementById('backup-status');
    try {
      backup.download(backup.fileName(this.channel), backup.exportJson(this.channel));
      if (status) status.textContent = "Saved. Keep it somewhere that isn't this browser.";
    } catch (err) {
      if (status) status.textContent = `Couldn't save it: ${err.message}`;
    }
  }

  async importData() {
    const status = document.getElementById('backup-status');
    const text = await backup.pickFile();
    if (text === null) return;
    const result = backup.importJson(this.channel, text);
    if (!result.ok) {
      if (status) status.textContent = `Couldn't restore it — ${result.reason}.`;
      return;
    }
    // Every store read its key on construction, so the running app is holding the
    // old deck. Reload rather than show a stale one.
    location.reload();
  }

  showStreak() {
    const today = new Date();
    const streak = this.progress.streak();
    this.openDialog(`
      <div class="row between">
        <h2 style="text-align:left">Your streak</h2>
        ${iconButton('close', 'Close', 'close-dialog')}
      </div>
      <div class="streak-hero">
        ${bubbleIcon('flame', { color: 'var(--apricot)', size: 46 })}
        <div>
          <h3>${streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} in a row` : 'No streak yet'}</h3>
          <p class="small muted">A day counts once you've done the new sentence
            and ${REVIEW_GOAL} reviews.</p>
        </div>
      </div>
      ${this.renderCalendar(today)}
    `).addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close-dialog"]')) e.currentTarget.close();
    });
  }

  renderCalendar(month) {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    // Monday-first, matching the Android calendar.
    const lead = (first.getDay() + 6) % 7;
    const today = epochDay();

    const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      .map((d) => `<div class="dow">${d}</div>`).join('');

    const blanks = Array.from({ length: lead }, () => '<div></div>').join('');
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, m, i + 1);
      const day = epochDay(date);
      const classes = [
        'day',
        this.progress.isComplete(day) ? 'complete' : '',
        day === today ? 'today' : '',
        day > today ? 'future' : '',
      ].filter(Boolean).join(' ');
      const inner = this.progress.isComplete(day) ? icon('flame', 'Completed') : String(i + 1);
      return `<div class="${classes}">${inner}</div>`;
    }).join('');

    const name = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return `<div>
      <p class="center" style="font-weight:700;margin-bottom:10px">${esc(name)}</p>
      <div class="calendar">${dows}${blanks}${days}</div>
    </div>`;
  }

  showLevelPicker() {
    const current = this.prefs.get('level');
    const chips = LEVELS.map((l) =>
      `<button type="button" class="chip" data-level="${l}"
        aria-pressed="${l === current}">${l}</button>`).join('');

    const dlg = this.openDialog(`
      <h2>Your level</h2>
      <p class="small muted center">New sentences come from this level only.
        Reviews keep coming from here and above, so moving up retires the levels
        you've left behind.</p>
      <div class="chipset" style="justify-content:center">${chips}</div>
      ${chunky('Done', 'close-dialog')}
    `);

    dlg.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-level]');
      if (chip) {
        this.prefs.set('level', chip.dataset.level);
        this.cycle.reset();
        this.views.daily.nextCard();
        for (const c of dlg.querySelectorAll('[data-level]')) {
          c.setAttribute('aria-pressed', String(c.dataset.level === chip.dataset.level));
        }
        this.render();
      }
      if (e.target.closest('[data-action="close-dialog"]')) dlg.close();
    });
  }

  showAddEntry() {
    const levels = LEVELS.map((l) =>
      `<button type="button" class="chip" data-level="${l}"
        aria-pressed="${l === this.prefs.get('level')}">${l}</button>`).join('');

    const field = (name, label, placeholder) => `
      <div class="field">
        <label for="f-${name}">${esc(label)}</label>
        <input id="f-${name}" name="${name}" placeholder="${esc(placeholder)}" autocomplete="off">
      </div>`;

    const dlg = this.openDialog(`
      <div class="row between">
        <h2 style="text-align:left">Add an entry</h2>
        ${iconButton('close', 'Cancel', 'close-dialog')}
      </div>
      <div>
        <p class="section-label" style="margin-bottom:8px">Level</p>
        <div class="chipset">${levels}</div>
      </div>
      ${field('dialect', this.lang.target, '')}
      ${field('literal', 'Word-for-word (English)', '')}
      ${field('natural', 'Meaning (English)', '')}
      ${field('note', 'Note (optional)', '')}
      ${chunky('Save', 'save-entry')}
    `);

    let level = this.prefs.get('level');
    dlg.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-level]');
      if (chip) {
        level = chip.dataset.level;
        for (const c of dlg.querySelectorAll('[data-level]')) {
          c.setAttribute('aria-pressed', String(c.dataset.level === level));
        }
      }
      if (e.target.closest('[data-action="close-dialog"]')) dlg.close();
      if (e.target.closest('[data-action="save-entry"]')) {
        const value = (n) => dlg.querySelector(`[name="${n}"]`).value.trim();
        const dialect = value('dialect');
        const literal = value('literal');
        const natural = value('natural');
        if (!dialect || !literal || !natural) {
          dlg.querySelector('[name="dialect"]').focus();
          return;
        }
        this.repo.userEntries.add({
          level, dialect, literal, natural,
          note: value('note') || undefined,
          kind: 'SENTENCE',
        });
        dlg.close();
        this.views.daily.nextCard();
        this.render();
      }
    });
  }

  /** The two "well done" moments: finishing a day, and levelling up. */
  celebrate(kind, arg) {
    const isLevel = kind === 'level';
    const streak = this.progress.streak();
    const tint = isLevel ? 'var(--heather)' : 'var(--apricot)';
    const body = isLevel
      ? `You've mastered your level — ${arg} is unlocked. New ${arg} sentences start
         showing up, and your earlier ones keep coming back for review.`
      : `Today's new sentence and ${REVIEW_GOAL} reviews, done.` +
        (streak > 1 ? ` ${streak} days in a row — keep it alive.` : ' Streak started.');

    this.openDialog(`
      <div class="center">${bubbleIcon('sparkle', { color: tint, size: 56 })}</div>
      <h2>${isLevel ? 'Level up!' : 'Day complete!'}</h2>
      <p class="center muted">${esc(body)}</p>
      ${chunky(isLevel ? "Let's go" : 'Keep going', 'close-dialog')}
    `).addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close-dialog"]')) e.currentTarget.close();
    });
  }
}

// --- boot ----------------------------------------------------------------

function shell(lang) {
  const nav = tabsFor(lang).map((t) => `
    <button type="button" class="navitem" data-tab="${t.id}"
      data-action="select-tab" data-arg="${t.id}">
      <span class="bubble">${icon(t.icon)}</span>
      <span>${esc(t.label)}</span>
    </button>`).join('');

  return `
    <header class="topbar">
      <h1>${esc(lang.appName)}</h1>
      <div class="topbar-actions">
        <button type="button" class="pill streak" data-action="open-streak">
          ${icon('flame')}<span id="streak-count">0</span>
          <span class="sr">day streak — open your calendar</span>
        </button>
        ${iconButton('settings', 'Settings', 'open-settings')}
      </div>
    </header>
    <main id="main"></main>
    <nav class="bottomnav">${nav}</nav>`;
}

/**
 * The first screen, when no language has been chosen yet.
 *
 * Shown instead of the app rather than as a dialog over it: there is nothing
 * meaningful to render behind it, since every deck and every sentence depends on
 * the answer.
 */
function renderPicker(root) {
  const options = CHANNELS.map((ch) => {
    const l = langFor(ch);
    return `
      <button type="button" class="langcard" data-action="pick-language" data-arg="${ch}">
        <span class="langflag">${l.flag}</span>
        <span class="langtext">
          <strong>${esc(l.pickerName)}</strong>
          <span class="small muted">${esc(l.pickerNote)}</span>
        </span>
      </button>`;
  }).join('');

  root.innerHTML = `
    <div class="picker">
      <h1>What do you want to learn?</h1>
      <p class="muted">Each language keeps its own deck, so you can come back and
        add another later without losing this one.</p>
      <div class="langlist">${options}</div>
    </div>`;
}

/**
 * Right-to-left is a property of the sentences, not of the app.
 *
 * Hebrew is the only RTL language here, and its chrome is still English — the
 * whole point of the project is that only the target language needs decoding. So
 * the document stays LTR and `data-target-dir` lets the CSS flip just the lines
 * that hold the language itself.
 */
function applyDirection(lang) {
  document.documentElement.setAttribute('data-target-dir', lang.dir);
}

async function boot() {
  const root = document.getElementById('app');

  // `?lang=hoi` picks a language straight from the link and remembers it, so one
  // language can be handed to someone as a URL rather than as an instruction to
  // tap the right card. It also means each language has an address of its own.
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isChannel(fromUrl)) {
    writeChannel(fromUrl);
    // Drop the parameter so a refresh or a bookmark doesn't keep overriding a
    // later change of language from Settings.
    history.replaceState(null, '', location.pathname);
  }

  const stored = readChannel();
  if (!isChannel(stored)) {
    renderPicker(root);
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action="pick-language"]');
      if (!el) return;
      writeChannel(el.dataset.arg);
      // A reload rather than an in-place swap: every store reads its file on
      // construction, so starting clean is both simpler and less to get wrong.
      location.reload();
    });
    return;
  }

  const channel = stored;
  const lang = langFor(channel);
  // Before any store is constructed — they all read on construction.
  useChannel(channel);
  applyDirection(lang);
  document.title = `${lang.appName} — ${lang.pickerName}`;

  const userEntries = new UserEntries();

  let repo;
  try {
    repo = await Repo.load(userEntries, channel);
  } catch (err) {
    root.innerHTML = `<div class="empty" style="margin:auto">
      ${bubbleIcon('close', { color: 'var(--coral)', size: 72 })}
      <h3>Couldn't load the content</h3>
      <p class="muted">${esc(err.message)}</p>
      <p class="small muted">If you opened this as a file, it needs to be served
        over http — try the link instead.</p></div>`;
    return;
  }

  root.innerHTML = shell(lang);
  const app = new App(repo, lang);
  app.render();

  // One delegated handler for the whole app.
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    app.handle(el.dataset.action, el.dataset.arg || '');
  });

  // The system theme can change under a 'system' preference.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => app.applyTheme());

  if ('serviceWorker' in navigator) {
    // Registered after first paint so it never delays the app appearing.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Offline support is a bonus; the app works fine without it.
      });
    });
  }
}

boot();
