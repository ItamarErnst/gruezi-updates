/**
 * Bridges — the web twin of `ui/BridgesScreen.kt`.
 *
 * One rule per card, then derive-then-reveal practice. Which examples have been
 * revealed is per-visit state, not persisted: coming back to a bridge should
 * give you the chance to work them out again.
 */

import {
  bubbleIcon, esc, ghostButton, icon, iconButton, pill, screenHeading, sectionLabel,
} from '../ui.js';

export class BridgesView {
  constructor(ctx) {
    this.ctx = ctx;
    this.openId = null;
    this.revealed = new Set();
  }

  /** Deep-link from a sentence card's bridge chip. */
  open(id) {
    this.openId = id;
    this.revealed.clear();
  }

  render() {
    const bridge = this.openId ? this.ctx.repo.bridge(this.openId) : null;
    return bridge ? this.renderDetail(bridge) : this.renderList();
  }

  renderList() {
    const rows = this.ctx.repo.bridges.map((b) => `
      <button type="button" class="card tappable list-row"
        data-action="open-bridge" data-arg="${esc(b.id)}"
        style="width:100%;text-align:left;margin-bottom:10px">
        ${bubbleIcon('bridges', { color: 'var(--heather)', background: 'var(--heather-soft)' })}
        <span class="grow">
          <strong>${esc(b.title)}</strong>
          <span class="small" style="display:block;margin-top:4px;color:var(--heather);font-weight:700">
            ${esc(b.rule)}</span>
          <span class="small muted" style="display:block;margin-top:6px">
            ${b.examples.length} to practise</span>
        </span>
        <span class="chev">${icon('chevronRight')}</span>
      </button>`).join('');

    return `${screenHeading('Bridges',
      'One rule, many words. Read the trick, then build each word yourself before you reveal it.')}
      <div style="margin-top:18px">${rows}</div>`;
  }

  renderDetail(bridge) {
    const examples = bridge.examples.map((ex, i) => {
      const open = this.revealed.has(i);
      const right = open
        ? `<span class="answer">${esc(ex.answer)}</span>${
            this.ctx.prefs.get('audio') && this.ctx.hasAudio(ex.answer)
              ? iconButton('speaker', 'Listen', 'play-audio', { arg: ex.answer })
              : ''}`
        : pill('Reveal', { variant: 'bridges', icon: 'eye' });
      const hint = ex.hint && !open
        ? `<span class="small muted" style="display:block;margin-top:3px">${esc(ex.hint)}</span>`
        : '';

      return `<button type="button" class="example ${open ? 'revealed' : ''}"
        data-action="${open ? 'noop' : 'reveal-example'}" data-arg="${i}">
        <span class="grow"><span class="prompt">${esc(ex.prompt)}</span>${hint}</span>
        <span class="row" style="gap:8px">${right}</span>
      </button>`;
    }).join('');

    return `<div class="row" style="margin-top:4px">
        ${ghostButton('All bridges', 'close-bridge', { icon: 'chevronLeft' })}
      </div>
      <h1 style="margin-top:16px">${esc(bridge.title)}</h1>
      <div class="rule-box" style="margin-top:12px">${icon('bridges')}
        <span>${esc(bridge.rule)}</span></div>
      <p style="margin-top:14px">${esc(bridge.hook)}</p>
      <div style="margin-top:24px">${sectionLabel('Your turn')}</div>
      <div style="margin-top:10px">${examples}</div>`;
  }

  handle(action, arg) {
    switch (action) {
      case 'open-bridge':
        this.open(arg);
        return true;
      case 'close-bridge':
        this.openId = null;
        return true;
      case 'reveal-example':
        this.revealed.add(Number(arg));
        return true;
      case 'noop':
        return true;
      default:
        return false;
    }
  }
}
