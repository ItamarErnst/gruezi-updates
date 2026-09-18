/**
 * The Learn path — the web twin of `ui/LearnScreen.kt`.
 *
 * The list is drawn as a path of numbered nodes so the order is visible at a
 * glance. Nothing is locked: the lessons are ordered, but there are plenty of
 * reasons to jump ahead or redo one, and a hard gate would only get in the way.
 */

import {
  chunky, esc, ghostButton, icon, iconButton, screenHeading, sectionLabel, track,
} from '../ui.js';

export class LearnView {
  constructor(ctx) {
    this.ctx = ctx;
    this.openId = null;
    this.step = 0;
    this.revealed = false;
  }

  get completed() {
    return this.ctx.progress.completedLessons;
  }

  render() {
    const lesson = this.openId ? this.ctx.repo.lesson(this.openId) : null;
    return lesson ? this.renderPlayer(lesson) : this.renderPath();
  }

  renderPath() {
    const { lessons } = this.ctx.repo;
    const done = this.completed;
    const nextIndex = lessons.findIndex((l) => !done.has(l.id));

    const rows = lessons.map((lesson, i) => {
      const isDone = done.has(lesson.id);
      const isNext = i === nextIndex;
      const nodeClass = isDone ? 'done' : isNext ? 'next' : '';
      const nodeInner = isDone ? icon('check', 'Done') : String(i + 1);
      // The titles carry their own "1 · " prefix; the node already shows the
      // number, so strip it here.
      const title = lesson.title.includes('·')
        ? lesson.title.split('·').slice(1).join('·').trim()
        : lesson.title;

      return `<div class="lesson-row ${i > 0 ? 'has-connector' : ''}">
        <div class="rail">
          <div class="connector ${i > 0 ? '' : 'hidden'}"></div>
          <div class="node ${nodeClass}">${nodeInner}</div>
        </div>
        <button type="button" class="card tappable list-row ${isNext ? 'next' : ''}"
          data-action="open-lesson" data-arg="${esc(lesson.id)}" style="text-align:left">
          <span class="grow">
            <strong>${esc(title)}</strong>
            <span class="small muted" style="display:block;margin-top:3px">
              ${lesson.steps.length} steps</span>
          </span>
          ${isNext
            ? '<span class="pill filled">Start</span>'
            : `<span class="chev">${icon('chevronRight')}</span>`}
        </button>
      </div>`;
    }).join('');

    const progress = lessons.length ? done.size / lessons.length : 0;

    return `${screenHeading('Learn',
      'Short, guided lessons. Build each sentence yourself before revealing — the struggle is what makes it stick.')}
      <div class="row" style="margin:16px 0 18px">
        ${track(progress, { color: 'var(--sky)' })}
        <span class="small muted">${done.size}/${lessons.length}</span>
      </div>
      ${rows}`;
  }

  renderPlayer(lesson) {
    const step = lesson.steps[this.step];
    const isLast = this.step === lesson.steps.length - 1;
    const progress = (this.step + (this.revealed ? 1 : 0)) / lesson.steps.length;

    const teach = step.teach
      ? `<div class="teach">${icon('learn')}<span>${esc(step.teach)}</span></div>`
      : '';

    const intro = this.step === 0
      ? `<p class="muted" style="margin-top:8px">${esc(lesson.intro)}</p>`
      : '';

    const hint = step.hint && !this.revealed
      ? `<p class="muted small" style="margin-top:8px">${esc(step.hint)}</p>`
      : '';

    const audio = this.revealed && this.ctx.prefs.get('audio') && this.ctx.hasAudio(step.answer)
      ? `<div style="margin-top:12px">
          ${ghostButton('Listen', 'play-audio', { icon: 'speaker', arg: step.answer })}</div>`
      : '';

    const face = this.revealed
      ? `<p class="dialect answer">${esc(step.answer)}</p>${audio}`
      : `<p class="reveal-hint">${icon('eye')}Say it out loud, then tap</p>`;

    const advance = !this.revealed
      ? chunky('Reveal', 'lesson-reveal')
      : isLast
        ? chunky('Finish lesson', 'lesson-finish', { icon: 'check' })
        : chunky('Next', 'lesson-next', { icon: 'chevronRight' });

    const back = this.step > 0
      ? `<div class="row" style="justify-content:center;margin-top:10px">
          ${ghostButton('Back', 'lesson-back', { icon: 'chevronLeft' })}</div>`
      : '';

    return `<div class="row" style="margin-top:4px">
        ${iconButton('close', 'Back to the path', 'close-lesson')}
        ${track(progress, { color: 'var(--sky)' })}
        <span class="small muted">${this.step + 1}/${lesson.steps.length}</span>
      </div>
      <h2 style="margin-top:16px">${esc(lesson.title)}</h2>
      ${intro}
      <div style="margin-top:18px">${teach}</div>
      <section class="card sentence-card tappable" style="margin-top:16px"
        data-action="lesson-reveal">
        <p style="font-size:1.35rem;font-weight:800;line-height:1.35">${esc(step.prompt)}</p>
        ${hint}
        ${face}
      </section>
      <div style="margin-top:20px">${advance}</div>
      ${back}`;
  }

  handle(action, arg) {
    switch (action) {
      case 'open-lesson':
        this.openId = arg;
        this.step = 0;
        this.revealed = false;
        return true;
      case 'close-lesson':
        this.openId = null;
        return true;
      case 'lesson-reveal':
        this.revealed = true;
        return true;
      case 'lesson-next':
        this.step += 1;
        this.revealed = false;
        return true;
      case 'lesson-back':
        this.step = Math.max(0, this.step - 1);
        this.revealed = true;
        return true;
      case 'lesson-finish':
        this.ctx.progress.completeLesson(this.openId);
        this.openId = null;
        return true;
      default:
        return false;
    }
  }
}
