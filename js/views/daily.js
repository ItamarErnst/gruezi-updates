/**
 * The Daily practice loop — the web twin of `ui/DailyScreen.kt`.
 *
 * Card selection follows the same order of urgency as the app, so the two feel
 * identical: a learning step that has come round, then today's new sentence,
 * then the due reviews, and only when nothing is owed does the rotation deal
 * free practice.
 */

import { Grade, Mode, Phase, REVIEW_GOAL } from '../store.js';
import { epochDay } from '../srs.js';
import { LEVELS } from '../repo.js';
import {
  bubbleIcon, chunky, emptyState, esc, ghostButton, icon, iconButton,
  pill, sectionLabel, track,
} from '../ui.js';

/** Why a card is on screen — it sets the banner and which goal it counts for. */
const Source = { NEW: 'new', STEP: 'step', DUE: 'due', EXTRA: 'extra' };

const BANNER = {
  [Source.NEW]: "Today's new sentence",
  [Source.STEP]: 'Coming back round',
  [Source.DUE]: 'Due for review',
  [Source.EXTRA]: 'Free practice',
};

export class DailyView {
  constructor(ctx) {
    this.ctx = ctx;               // { repo, reviews, cycle, progress, prefs, toast, openBridge, refreshChrome }
    this.current = null;
    this.source = Source.NEW;
    this.mode = Mode.READ;
    this.revealed = false;
  }

  get level() {
    return this.ctx.prefs.get('level');
  }

  // --- selecting the next card ------------------------------------------

  seenIds() {
    const { repo, reviews } = this.ctx;
    return new Set(repo.all().filter((s) => reviews.isSeen(s.id)).map((s) => s.id));
  }

  reviewCandidates() {
    const { repo, reviews } = this.ctx;
    return repo.reviewPool(this.level).filter((s) => reviews.isSeen(s.id));
  }

  todays() {
    return this.ctx.repo.daily(this.level, this.seenIds(), epochDay());
  }

  /** Cards you're struggling with drift to the front of a rotation pass. */
  weightOf(id) {
    const { reviews } = this.ctx;
    if (reviews.isHard(id)) return 5;
    if (reviews.isMastered(id)) return 1;
    return 3;
  }

  show(sentence, source, mode = Mode.READ) {
    this.current = sentence;
    this.source = source;
    // You can't recall a card you've never met, so anything new starts in READ.
    this.mode = mode;
    this.revealed = false;
  }

  nextCard() {
    const { reviews, cycle, progress } = this.ctx;
    const candidates = this.reviewCandidates();
    const byId = new Map(candidates.map((s) => [s.id, s]));
    const ids = candidates.map((s) => s.id);
    const queue = reviews.dueQueue(ids);

    // 1. A learning/relearning step that's come round — letting those wait
    //    defeats the point of the short steps.
    const step = queue.find((q) => q.card.phase !== Phase.REVIEW);
    if (step) return this.show(byId.get(step.id), Source.STEP, step.mode);

    // 2. Today's new sentence.
    if (!progress.newSentenceDone()) {
      const fresh = this.todays();
      if (fresh) return this.show(fresh, Source.NEW);
    }

    // 3. Anything else that fell due, most overdue first.
    const due = queue[0];
    if (due) return this.show(byId.get(due.id), Source.DUE, due.mode);

    // 4. Nothing owed — the rotation deals free practice.
    const slot = cycle.next(ids, (id) => this.weightOf(id));
    if (!slot) return this.show(this.todays(), Source.NEW);
    return this.show(byId.get(slot.id), Source.EXTRA, slot.mode);
  }

  // --- grading -----------------------------------------------------------

  onGrade(g) {
    const { reviews, progress } = this.ctx;
    const card = this.current;
    if (!card) return;

    reviews.grade(card.id, this.mode, g);
    progress.markGraded(card.id);
    // Only the day's new sentence satisfies the "new" goal.
    const completed = this.source === Source.NEW
      ? progress.markNewSentence()
      : progress.addReview();

    this.nextCard();
    this.maybeLevelUp();
    this.ctx.refreshChrome();
    if (completed) this.ctx.celebrate('day');
  }

  /**
   * Auto level-up: once nothing at this level is still being worked on and a
   * majority are comfortably known, unlock the next one. Unseen cards count
   * against the majority, so the level can't be skipped by accident.
   */
  maybeLevelUp() {
    const { repo, reviews, cycle, prefs } = this.ctx;
    const nextIndex = LEVELS.indexOf(this.level) + 1;
    if (nextIndex >= LEVELS.length) return;

    const atLevel = repo.newPool(this.level);
    if (atLevel.length === 0) return;
    if (atLevel.some((s) => reviews.isHard(s.id))) return;
    const mastered = atLevel.filter((s) => reviews.isMastered(s.id)).length;
    if (mastered * 2 <= atLevel.length) return;

    const next = LEVELS[nextIndex];
    prefs.set('level', next);
    cycle.reset();
    this.nextCard();
    this.ctx.celebrate('level', next);
  }

  onForget() {
    if (!this.current) return;
    this.ctx.reviews.forget(this.current.id);
    this.nextCard();
    this.ctx.refreshChrome();
  }

  // --- rendering ---------------------------------------------------------

  render() {
    if (!this.current) this.nextCard();
    return `${this.renderHeader()}${this.renderCard()}`;
  }

  renderHeader() {
    const { progress, reviews } = this.ctx;
    const newDone = progress.newSentenceDone();
    const done = progress.reviewsDone();
    const complete = newDone && done >= REVIEW_GOAL;
    const dueNow = reviews.dueCount(this.reviewCandidates().map((s) => s.id));
    const canTestOut = LEVELS.indexOf(this.level) < LEVELS.length - 1;

    const levelPill = pill(`Level ${this.level}`, {
      variant: 'accent',
      icon: 'trophy',
      action: canTestOut ? 'change-level' : null,
    });
    const duePill = dueNow > 0 ? pill(`${dueNow} due`, { variant: 'sky' }) : '';

    const progressValue = ((newDone ? 1 : 0) + done) / (1 + REVIEW_GOAL);
    const dots = Array.from({ length: REVIEW_GOAL }, (_, i) =>
      `<span class="dot" style="width:12px;height:12px;border-radius:999px;background:${
        i < done ? 'var(--primary)' : 'var(--card-alt)'
      }"></span>`).join('');

    const goal = complete
      ? `<div class="row">${bubbleIcon('check', { color: 'var(--g-good)', size: 34 })}
           <div><strong>Today's goal is done</strong>
           <p class="small muted">Anything more is free practice.</p></div></div>`
      : `<div class="row">${track(progressValue)}
           <span class="small muted">${(newDone ? 1 : 0) + done}/${REVIEW_GOAL + 1}</span></div>
         <div class="row" style="margin-top:10px;gap:6px">
           ${pill('New', { variant: newDone ? 'filled' : '' })}${dots}</div>`;

    return `<section class="card" style="margin-top:4px">
      <div class="row between">
        <div class="row" style="gap:8px">${levelPill}${duePill}</div>
        ${iconButton('plus', 'Add your own', 'add-entry')}
      </div>
      <div style="margin-top:14px">${goal}</div>
    </section>`;
  }

  renderCard() {
    const s = this.current;
    if (!s) {
      return emptyState('plus', 'Nothing at this level yet',
        'Tap the + above to add your own word or sentence.');
    }

    const recall = this.mode === Mode.RECALL;
    const banner = `<div class="banner ${this.source}">
      <span>${esc(BANNER[this.source])}</span>
      ${pill(recall ? 'Recall' : 'Read')}
    </div>`;

    return `${banner}${this.renderSentence(s, recall)}${this.revealed ? this.renderGrades(s) : ''}`;
  }

  renderSentence(s, recall) {
    const showPhonetics = this.ctx.prefs.get('phonetics') && s.phonetics;
    const phon = showPhonetics ? `<p class="phonetics">${esc(s.phonetics)}</p>` : '';

    // In RECALL the phonetics would hand over the answer, so they wait for the
    // reveal; in READ they belong with the sentence from the start.
    const front = recall
      ? `<p class="prompt-natural">${esc(s.natural)}</p>`
      : `<p class="dialect">${esc(s.dialect)}</p>${phon}`;

    let back = '';
    if (!this.revealed) {
      back = `<p class="reveal-hint">${icon('eye')}
        ${recall ? 'Say it in Züritüütsch, then tap' : 'Tap to reveal'}</p>`;
    } else if (recall) {
      back = `<div class="answer-block">
        ${sectionLabel('Züritüütsch')}
        <p class="dialect answer">${esc(s.dialect)}</p>${phon}
        ${sectionLabel('Word-for-word')}
        <p class="literal">${esc(s.literal)}</p></div>`;
    } else {
      back = `<div class="answer-block">
        ${sectionLabel('Word-for-word')}
        <p class="literal">${esc(s.literal)}</p>
        ${sectionLabel('Meaning')}
        <p class="natural">${esc(s.natural)}</p></div>`;
    }

    const note = this.revealed && s.note
      ? `<div class="note">${icon('sparkle')}<span>${esc(s.note)}</span></div>`
      : '';

    const bridges = this.revealed ? this.ctx.repo.bridgesFor(s) : [];
    const bridgeChips = bridges.length
      ? `<div style="margin-top:20px">${sectionLabel('Bridges in this one')}
          <div class="row wrap" style="margin-top:8px;justify-content:center">
          ${bridges.map((b) => pill(b.title, {
            variant: 'bridges', icon: 'bridges', action: 'open-bridge', arg: b.id,
          })).join('')}</div></div>`
      : '';

    return `<section class="card sentence-card tappable" data-action="toggle-reveal">
      ${pill(s.level, { variant: 'accent' })}
      ${front}${back}${note}${bridgeChips}
    </section>`;
  }

  renderGrades(s) {
    const previews = this.ctx.reviews.previewLabels(s.id, this.mode);
    const keys = Object.values(Grade).map((g) => `
      <button type="button" class="gradekey" data-grade="${g}" data-action="grade" data-arg="${g}">
        <span class="slab"></span>
        <span class="face">
          <span class="label">${esc(g === 'GOOD' ? 'Good' : g[0] + g.slice(1).toLowerCase())}</span>
          <span class="interval">${esc(previews[g])}</span>
        </span>
      </button>`).join('');

    const audioButton = this.ctx.prefs.get('audio') && this.ctx.hasAudio(s.dialect)
      ? ghostButton('Listen', 'play-audio', { icon: 'speaker', arg: s.dialect })
      : '';

    const forget = this.ctx.reviews.isSeen(s.id)
      ? ghostButton('Forget', 'forget')
      : '<span></span>';

    return `<div style="margin-top:18px">
      ${audioButton ? `<div class="row" style="justify-content:center;margin-bottom:16px">${audioButton}</div>` : ''}
      ${sectionLabel('How well did you know it?')}
      <div class="grades" style="margin-top:8px">${keys}</div>
      <div class="row between" style="margin-top:12px">
        ${forget}
        ${ghostButton('Skip', 'skip')}
      </div>
    </div>`;
  }

  // --- actions from the delegated click handler --------------------------

  handle(action, arg) {
    switch (action) {
      case 'toggle-reveal':
        this.revealed = !this.revealed;
        return true;
      case 'grade':
        this.onGrade(arg);
        return true;
      case 'skip':
        this.nextCard();
        return true;
      case 'forget':
        this.onForget();
        return true;
      default:
        return false;
    }
  }
}
