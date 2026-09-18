/**
 * Small rendering helpers shared by the views.
 *
 * The app renders by building HTML strings and assigning them once per view,
 * then handling clicks by delegation from the container. With three screens and
 * no list virtualisation that's less machinery than a framework and no build
 * step — which is the point, since this has to be a folder you can upload.
 */

import { icon } from './icons.js';

/** Escape text that came from content JSON or the user before interpolating. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A tagged template that escapes every interpolation. Use `raw()` to opt out. */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = values[i - 1];
    const text = v && v.__raw ? v.value : esc(v);
    return out + text + s;
  });
}

/** Mark an already-safe HTML string so `html` won't escape it. */
export function raw(value) {
  return { __raw: true, value: value ?? '' };
}

/** Join a list of already-safe fragments. */
export function join(parts) {
  return raw(parts.join(''));
}

export function pill(label, { variant = '', icon: iconName = null, action = null, arg = '' } = {}) {
  const tag = action ? 'button' : 'span';
  const attrs = action ? ` type="button" data-action="${esc(action)}" data-arg="${esc(arg)}"` : '';
  const ic = iconName ? icon(iconName) : '';
  return `<${tag} class="pill ${esc(variant)}"${attrs}>${ic}<span>${esc(label)}</span></${tag}>`;
}

export function iconButton(iconName, label, action, { arg = '', variant = '' } = {}) {
  return `<button type="button" class="iconbtn ${esc(variant)}" data-action="${esc(action)}"
    data-arg="${esc(arg)}" aria-label="${esc(label)}">${icon(iconName)}</button>`;
}

export function chunky(label, action, { arg = '', icon: iconName = null, color = null, disabled = false } = {}) {
  const style = color ? ` style="--c: ${esc(color)}"` : '';
  return `<button type="button" class="chunky" data-action="${esc(action)}" data-arg="${esc(arg)}"
    ${disabled ? 'disabled' : ''}${style}>
      <span class="slab"></span>
      <span class="face">${iconName ? icon(iconName) : ''}<span>${esc(label)}</span></span>
    </button>`;
}

export function ghostButton(label, action, { arg = '', icon: iconName = null } = {}) {
  return `<button type="button" class="ghostbtn" data-action="${esc(action)}" data-arg="${esc(arg)}">
    ${iconName ? icon(iconName) : ''}<span>${esc(label)}</span></button>`;
}

export function track(progress, { color = null } = {}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const style = color ? ` style="background: ${esc(color)}"` : '';
  return `<div class="track"><div style="width:${pct}%"${style}></div></div>`;
}

export function bubbleIcon(iconName, { color = 'var(--primary)', background = null, size = 44 } = {}) {
  const bg = background || `color-mix(in srgb, ${color} 15%, transparent)`;
  return `<span class="bubble-icon" style="background:${esc(bg)};color:${esc(color)};
    width:${size}px;height:${size}px">${icon(iconName)}</span>`;
}

export function emptyState(iconName, title, body = '') {
  return `<div class="empty">${bubbleIcon(iconName, { size: 72 })}
    <h3>${esc(title)}</h3>${body ? `<p class="muted">${esc(body)}</p>` : ''}</div>`;
}

export function sectionLabel(text) {
  return `<p class="section-label">${esc(text)}</p>`;
}

/** The title + standfirst each top-level screen opens with. */
export function screenHeading(title, body) {
  return `<h1>${esc(title)}</h1><p class="muted" style="margin-top:6px">${esc(body)}</p>`;
}

export { icon };
