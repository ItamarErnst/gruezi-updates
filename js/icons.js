/**
 * The same icon set as the Android app (`ui/Icons.kt`), as inline SVG.
 *
 * Kept as raw path data rather than separate files so they render with the
 * first paint and inherit `currentColor` — an <img> would flash and couldn't
 * follow the theme. House style: 24-unit grid, 2-unit round-capped stroke,
 * nothing filled.
 */

const PATHS = {
  daily: [
    'M2.5,19.5 h19',
    'M4.5,19.5 l5,-8 3.5,5.5 2.5,-4 4.5,6.5',
    'M16.8,7.2 m-2.6,0 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0',
  ],
  learn: [
    'M12,7.2 C10.4,5.6 8.2,5 5.6,5 4.7,5 4,5.5 4,6.3 v10.4 C4,17.5 4.7,18 5.6,18 8.2,18 10.4,18.6 12,20.2',
    'M12,7.2 C13.6,5.6 15.8,5 18.4,5 19.3,5 20,5.5 20,6.3 v10.4 C20,17.5 19.3,18 18.4,18 15.8,18 13.6,18.6 12,20.2',
    'M12,7.2 V20.2',
  ],
  bridges: [
    'M2.5,11.5 h19',
    'M5.5,19.5 A6.5,6.5 0 0,1 18.5,19.5',
    'M3,19.5 h18',
  ],
  flame: [
    'M12,2.8 C12,2.8 16.6,6.6 16.6,11.2 A4.6,4.6 0 1,1 7.4,11.2 C7.4,9 8.6,7.4 9.8,6.2 9.8,7.7 10.5,8.6 11.4,9 12.2,7.4 12,4.8 12,2.8 Z',
  ],
  settings: [
    'M4,7 h4', 'M13,7 h7', 'M10.5,7 m-2.2,0 a2.2,2.2 0 1,0 4.4,0 a2.2,2.2 0 1,0 -4.4,0',
    'M4,12.5 h8', 'M16.5,12.5 h3.5', 'M14.3,12.5 m-2.2,0 a2.2,2.2 0 1,0 4.4,0 a2.2,2.2 0 1,0 -4.4,0',
    'M4,18 h2.5', 'M11,18 h9', 'M8.7,18 m-2.2,0 a2.2,2.2 0 1,0 4.4,0 a2.2,2.2 0 1,0 -4.4,0',
  ],
  speaker: [
    'M4,9.5 H7 L11.5,5.5 V18.5 L7,14.5 H4 Z',
    'M15,9.8 a3.6,3.6 0 0,1 0,4.4',
    'M17.6,7.2 a7.2,7.2 0 0,1 0,9.6',
  ],
  plus: ['M12,5 V19', 'M5,12 H19'],
  check: ['M4.5,12.5 L9.5,17.5 L19.5,6.5'],
  close: ['M6,6 L18,18', 'M18,6 L6,18'],
  chevronRight: ['M9.5,5 L16.5,12 L9.5,19'],
  chevronLeft: ['M14.5,5 L7.5,12 L14.5,19'],
  eye: [
    'M2.5,12 C2.5,12 6,5.5 12,5.5 C18,5.5 21.5,12 21.5,12 C21.5,12 18,18.5 12,18.5 C6,18.5 2.5,12 2.5,12 Z',
    'M12,12 m-2.7,0 a2.7,2.7 0 1,0 5.4,0 a2.7,2.7 0 1,0 -5.4,0',
  ],
  sparkle: [
    'M11,3 L12.7,7.8 L17.5,9.5 L12.7,11.2 L11,16 L9.3,11.2 L4.5,9.5 L9.3,7.8 Z',
    'M18,15 L18.8,17.2 L21,18 L18.8,18.8 L18,21 L17.2,18.8 L15,18 L17.2,17.2 Z',
  ],
  undo: ['M3.6,9.5 A9,9 0 1,1 3.2,14.5', 'M3.2,4.5 V9.8 H8.5'],
  trophy: [
    'M7,4.5 h10 v4.5 a5,5 0 0,1 -10,0 Z',
    'M7,6 H4.5 a2.5,2.5 0 0,0 5,2.6',
    'M17,6 h2.5 a2.5,2.5 0 0,1 -5,2.6',
    'M12,14 v3.5',
    'M8.5,19.5 h7',
  ],
};

/**
 * One icon as an SVG string. `title` gives it an accessible name; without one
 * it's marked decorative, which is right when adjacent text already says it.
 */
export function icon(name, title = null) {
  const paths = PATHS[name];
  if (!paths) throw new Error(`unknown icon: ${name}`);
  const a11y = title
    ? `role="img" aria-label="${title}"`
    : 'aria-hidden="true" focusable="false"';
  const d = paths.map((p) => `<path d="${p}"/>`).join('');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" ${a11y}>${d}</svg>`;
}
