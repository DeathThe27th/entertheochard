import gsap from 'gsap';
import { reduced, d } from './motion';
import type { Cue } from './sound';

/**
 * The illustrated world. Two flat SVG views share one stage:
 *  - outside: the open field, the brick wall and the gate (the transparent chain)
 *  - inside: the orchard, 120 identical trees (the shielded pool)
 * A camera frames a world-space box inside whatever part of the stage the
 * panel leaves free, so the same framing works on a phone and a desktop.
 */

type Box = { x: number; y: number; w: number; h: number };
type Area = 'auto' | 'hero';
export type View = 'outside' | 'inside';

export const BOX = {
  hero: { x: 400, y: 384, w: 620, h: 250 },
  gate: { x: 400, y: 392, w: 250, h: 170 },
  gateTight: { x: 400, y: 396, w: 90, h: 80 },
  wall: { x: 432, y: 430, w: 330, h: 230 },
  field: { x: 380, y: 452, w: 360, h: 250 },
  stall: { x: 450, y: 452, w: 340, h: 240 },
  backGate: { x: 400, y: 150, w: 140, h: 110 },
  orchard: { x: 400, y: 392, w: 560, h: 420 },
  low: { x: 400, y: 560, w: 260, h: 170 },
  golden: { x: 400, y: 340, w: 820, h: 540 },
} satisfies Record<string, Box>;

const TREE_USE = '<use href="#tree" x="-50" y="-122" width="100" height="126"/>';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
// Native SVG animation, not CSS: CSS transform animations on many SVG groups
// stalled Chrome's style recalc on desktop. Rotates around the tree's base (0,0).
const sway = () => {
  if (reduced) return `<g>${TREE_USE}</g>`;
  const dur = rnd(5, 8).toFixed(2);
  const a = rnd(1, 1.6).toFixed(2);
  return `<g><animateTransform attributeName="transform" type="rotate" values="-${a};${a};-${a}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur}s" begin="-${rnd(0, 8).toFixed(2)}s" repeatCount="indefinite"/>${TREE_USE}</g>`;
};

/** Pollen drifting through the light, as native SVG animation. */
function motes(n: number, x0: number, x1: number, y0: number, y1: number) {
  if (reduced) return '';
  let m = '<g class="motes" pointer-events="none">';
  for (let i = 0; i < n; i++) {
    const x = rnd(x0, x1);
    const y = rnd(y0, y1);
    const r = rnd(0.7, 2.1).toFixed(2);
    const dur = rnd(9, 18).toFixed(1);
    const dx = rnd(30, 90).toFixed(0);
    const dy = rnd(-80, -30).toFixed(0);
    const begin = `-${rnd(0, 18).toFixed(1)}s`;
    m += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="#FFF1C9"><animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy}" dur="${dur}s" begin="${begin}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.85;.6;0" dur="${dur}s" begin="${begin}" repeatCount="indefinite"/></circle>`;
  }
  return m + '</g>';
}

function brickPattern(id: string, w: number, h: number) {
  const bh = h / 2 - 1;
  return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
    <rect width="${w}" height="${h}" fill="#D9C8B0"/>
    <rect x="1" y="1" width="${w - 2}" height="${bh - 0.5}" fill="#8B3A2B"/>
    <rect x="${-w / 2 + 1}" y="${h / 2 + 1}" width="${w - 2}" height="${bh - 0.5}" fill="#7E3326"/>
    <rect x="${w / 2 + 1}" y="${h / 2 + 1}" width="${w - 2}" height="${bh - 0.5}" fill="#95432F"/>
  </pattern>`;
}

function espalier(x: number) {
  let s = `<g class="espalier" transform="translate(${x} 0)">`;
  s += `<path d="M0 442 V318" stroke="#5B3B24" stroke-width="5" stroke-linecap="round"/>`;
  for (const y of [412, 380, 348]) {
    s += `<path d="M0 ${y + 4} Q-6 ${y} -70 ${y}" stroke="#5B3B24" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M0 ${y + 4} Q6 ${y} 70 ${y}" stroke="#5B3B24" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    for (let i = -64; i <= 64; i += 11) {
      if (Math.abs(i) < 6) continue;
      const up = (i / 11) % 2 === 0 ? -1 : 1;
      s += `<ellipse cx="${i}" cy="${y + up * 4}" rx="6" ry="3.2" fill="${Math.abs(i) % 22 < 11 ? '#3E6B45' : '#2E5537'}" transform="rotate(${up * 25} ${i} ${y + up * 4})"/>`;
    }
    s += `<circle cx="-38" cy="${y + 6}" r="3.6" fill="#E3A33B"/><circle cx="44" cy="${y + 6}" r="3.6" fill="#E3A33B"/>`;
  }
  s += `<path d="M0 318 Q-4 306 -10 304 M0 318 Q4 306 10 302" stroke="#3E6B45" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  return s + '</g>';
}

function outsideSvg() {
  let backTrees = '';
  for (let x = -780; x <= 1580; x += 52) {
    const s = rnd(0.78, 0.95).toFixed(2);
    backTrees += `<g transform="translate(${x + rnd(-8, 8)} ${rnd(332, 340)}) scale(${s})">${sway()}</g>`;
  }
  let tufts = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd(-300, 1100);
    const y = rnd(452, 620);
    tufts += `<path d="M${x} ${y} l2 -7 l2 7 l3 -5 l1 5" stroke="#4A5E2F" stroke-width="1.3" fill="none" opacity=".7"/>`;
  }
  return `<svg class="view" id="outside" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="o-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-200" x2="0" y2="330">
      <stop offset="0" stop-color="#9DB3B4"/><stop offset=".55" stop-color="#EBC999"/><stop offset="1" stop-color="#F6E3BF"/>
    </linearGradient>
    <radialGradient id="o-sun"><stop offset="0" stop-color="#FFF6DD"/><stop offset=".25" stop-color="#FBE0A6" stop-opacity=".9"/><stop offset="1" stop-color="#F6C978" stop-opacity="0"/></radialGradient>
    ${brickPattern('o-brick', 36, 18)}
    <linearGradient id="o-wallshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9A6" stop-opacity=".22"/><stop offset="1" stop-color="#1A0D08" stop-opacity=".38"/></linearGradient>
    <linearGradient id="o-grass" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="700"><stop offset="0" stop-color="#7F8D4C"/><stop offset="1" stop-color="#4F6435"/></linearGradient>
    <linearGradient id="o-path" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="640"><stop offset="0" stop-color="#C9B184"/><stop offset="1" stop-color="#DCC69C"/></linearGradient>
    <linearGradient id="o-light" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC27A" stop-opacity=".32"/><stop offset=".6" stop-color="#FFC27A" stop-opacity="0"/></linearGradient>
    <linearGradient id="o-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6E3BF" stop-opacity="0"/><stop offset=".7" stop-color="#F6E3BF" stop-opacity=".38"/><stop offset="1" stop-color="#F6E3BF" stop-opacity=".1"/></linearGradient>
    <linearGradient id="o-ray" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3D6" stop-opacity=".5"/><stop offset="1" stop-color="#FFF3D6" stop-opacity="0"/></linearGradient>
    <radialGradient id="o-glow"><stop offset="0" stop-color="#FFE3A0" stop-opacity=".95"/><stop offset="1" stop-color="#E3A33B" stop-opacity="0"/></radialGradient>
    <clipPath id="o-arch"><path d="M360 441 V372 A40 40 0 0 1 440 372 V441 Z"/></clipPath>
  </defs>
  <g class="cam">
    <rect x="-800" y="-700" width="2400" height="1100" fill="url(#o-sky)"/>
    <circle cx="640" cy="200" r="170" fill="url(#o-sun)"/>
    <path d="M-800 318 C-420 280 -120 304 140 290 S520 262 720 288 S1300 276 1600 300 V420 H-800Z" fill="#C2AC7A" opacity=".55"/>
    <g class="back-trees">${backTrees}</g>
    <rect x="-800" y="180" width="2400" height="160" fill="url(#o-haze)" pointer-events="none"/>
    <g id="isap" opacity="0" transform="translate(452 330)">
      <circle cx="0" cy="-70" r="48" fill="url(#o-glow)"/>
      <g transform="scale(.7)">${sway()}</g>
    </g>
    <rect x="-800" y="300" width="2400" height="142" fill="url(#o-brick)"/>
    <rect x="-800" y="300" width="2400" height="142" fill="url(#o-wallshade)"/>
    <rect x="-800" y="291" width="2400" height="12" fill="#A65441"/>
    <rect x="-800" y="291" width="2400" height="3" fill="#C98266"/>
    ${espalier(214)}${espalier(588)}
    <g class="pillars">
      <rect x="338" y="270" width="24" height="172" fill="url(#o-brick)"/><rect x="338" y="270" width="24" height="172" fill="url(#o-wallshade)"/>
      <rect x="438" y="270" width="24" height="172" fill="url(#o-brick)"/><rect x="438" y="270" width="24" height="172" fill="url(#o-wallshade)"/>
      <rect x="333" y="260" width="34" height="13" rx="2" fill="#A65441"/><rect x="433" y="260" width="34" height="13" rx="2" fill="#A65441"/>
      <circle cx="350" cy="254" r="7" fill="#B9644E"/><circle cx="450" cy="254" r="7" fill="#B9644E"/>
    </g>
    <g clip-path="url(#o-arch)">
      <rect x="356" y="320" width="88" height="124" fill="#E9CF97"/>
      <rect x="356" y="400" width="88" height="44" fill="#6F8A45"/>
      <g transform="translate(378 418) scale(.55)">${TREE_USE}</g>
      <g transform="translate(424 414) scale(.5)">${TREE_USE}</g>
      <g transform="translate(400 426) scale(.6)">${TREE_USE}</g>
      <g id="door-l">
        <rect x="360" y="318" width="40" height="124" fill="#6B4423"/>
        <path d="M370 318 V442 M380 318 V442 M390 318 V442" stroke="#57361B" stroke-width="1.2"/>
        <rect x="360" y="352" width="40" height="4" fill="#2C2622"/><rect x="360" y="418" width="40" height="4" fill="#2C2622"/>
        <circle cx="364" cy="354" r="1.6" fill="#8C8580"/><circle cx="364" cy="420" r="1.6" fill="#8C8580"/>
      </g>
      <g id="door-r">
        <rect x="400" y="318" width="40" height="124" fill="#6B4423"/>
        <path d="M410 318 V442 M420 318 V442 M430 318 V442" stroke="#57361B" stroke-width="1.2"/>
        <rect x="400" y="352" width="40" height="4" fill="#2C2622"/><rect x="400" y="418" width="40" height="4" fill="#2C2622"/>
        <circle cx="436" cy="354" r="1.6" fill="#8C8580"/><circle cx="436" cy="420" r="1.6" fill="#8C8580"/>
        <circle cx="404" cy="396" r="2.2" fill="#2C2622"/>
      </g>
    </g>
    <path d="M360 441 V372 A40 40 0 0 1 440 372 V441" stroke="#3A2A1E" stroke-width="4" fill="none"/>
    <g transform="translate(400 394)"><g id="lock">
      <path id="shackle" d="M-6 -2 V-9 A6 6 0 0 1 6 -9 V-2" stroke="#3A3530" stroke-width="2.6" fill="none"/>
      <rect x="-8" y="-3" width="16" height="14" rx="2.5" fill="#B08A3E"/>
      <rect x="-8" y="-3" width="16" height="4" rx="2" fill="#C9A456"/>
      <circle cy="3.4" r="1.9" fill="#2A2420"/><rect x="-.8" y="3.4" width="1.6" height="4" fill="#2A2420"/>
    </g></g>
    <g transform="translate(400 398)"><g id="gkey" opacity="0">
      <g id="gkey-turn">
        <path d="M0 0 H13 M6 0 V3.5 M9.5 0 V3" stroke="#E3A33B" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="18" cy="0" r="5" stroke="#E3A33B" stroke-width="2.4" fill="none"/>
      </g>
    </g></g>
    <rect x="-800" y="440" width="2400" height="560" fill="url(#o-grass)"/>
    <path d="M372 440 H428 L512 660 H288Z" fill="url(#o-path)"/>
    ${tufts}
    <g id="stall" opacity="0" transform="translate(522 524)">
      <ellipse cx="0" cy="2" rx="40" ry="6" fill="#000" opacity=".16"/>
      <rect x="-34" y="-56" width="4" height="58" fill="#6B4423"/><rect x="30" y="-56" width="4" height="58" fill="#6B4423"/>
      <rect x="-38" y="-24" width="76" height="26" fill="#8A5A34"/><rect x="-38" y="-26" width="76" height="5" fill="#A87446"/>
      <path d="M-44 -54 H44 L38 -72 H-38Z" fill="#F4EBDD"/>
      <path d="M-44 -54 L-38 -72 H-24 L-28 -54Z M-12 -54 L-10 -72 H4 L4 -54Z M20 -54 L18 -72 H30 L34 -54Z" fill="#8B3A2B"/>
      <text x="0" y="-8" text-anchor="middle" class="svg-label" fill="#F4EBDD">EXCHANGE</text>
      <g id="stall-sign" opacity="0" transform="translate(54 0)">
        <rect x="-2" y="-28" width="4" height="28" fill="#6B4423"/>
        <rect x="-27" y="-46" width="54" height="20" rx="2" fill="#C9A46A" stroke="#6B4423" stroke-width="1.5"/>
        <text id="stall-t" x="0" y="-32" text-anchor="middle" class="svg-sign">0.20 ZEC</text>
      </g>
    </g>
    <g id="stranger" opacity="0" transform="translate(484 522)">
      <ellipse cx="0" cy="1" rx="20" ry="4" fill="#000" opacity=".2"/>
      <g id="stranger-body">
        <path d="M-19 0 C-17 -30 -14 -54 0 -70 C14 -54 17 -30 19 0Z" fill="#2A2420"/>
        <path d="M-14 -56 C-14 -82 14 -82 14 -56 C9 -63 -9 -63 -14 -56Z" fill="#3A302A"/>
        <ellipse cx="0" cy="-60" rx="8.5" ry="7.5" fill="#110E0C"/>
        <circle cx="-3.2" cy="-61" r="1.3" fill="#F2D28B"/><circle cx="3.2" cy="-61" r="1.3" fill="#F2D28B"/>
        <path d="M-12 -34 C-20 -28 -22 -18 -16 -14" stroke="#3A302A" stroke-width="5" fill="none" stroke-linecap="round"/>
      </g>
    </g>
    <g id="ftree" opacity="0">
      <g id="ftree-s">${sway()}</g>
    </g>
    <g id="fsign" opacity="0">
      <g id="fsign-tilt">
        <rect x="-2" y="-30" width="4" height="30" fill="#6B4423"/>
        <rect x="-27" y="-48" width="54" height="20" rx="2" fill="#C9A46A" stroke="#6B4423" stroke-width="1.5"/>
        <text id="fsign-t" x="0" y="-34" text-anchor="middle" class="svg-sign">0.50 ZEC</text>
      </g>
    </g>
    <circle id="ofruit" r="5.5" fill="#E3A33B" stroke="#B47A22" stroke-width="1" opacity="0"/>
    <g class="ofx"></g>
    ${motes(26, 60, 760, 120, 560)}
    <rect x="-800" y="-700" width="2400" height="1700" fill="url(#o-light)" pointer-events="none"/>
    <g class="rays" pointer-events="none" opacity=".55">
      <path d="M700 120 L120 640 L250 640 Z" fill="url(#o-ray)" opacity=".35"/>
      <path d="M700 120 L380 660 L470 660 Z" fill="url(#o-ray)" opacity=".28"/>
      <path d="M700 120 L640 660 L760 660 Z" fill="url(#o-ray)" opacity=".2"/>
    </g>
  </g>
</svg>`;
}

type TreeSlot = { x: number; y: number; s: number; el: SVGGElement };

function insideSvg(trees: { x: number; y: number; s: number }[], userIdx: number) {
  let t = '';
  let lastY = 0;
  trees.forEach((p, i) => {
    // Every few rows, lay a veil of warm haze over everything behind.
    if (i % 12 === 0 && i > 0 && i <= 72 && (i / 12) % 2 === 0) {
      t += `<rect x="-800" y="90" width="2400" height="${(lastY + 4).toFixed(0)}" fill="#EED7A8" opacity=".2" pointer-events="none"/>`;
    }
    lastY = p.y - 90;
    const user = i === userIdx;
    t += `<g class="otree${user ? ' is-user' : ''}" data-i="${i}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.s.toFixed(3)})"${user ? ' opacity="0"' : ''}>`;
    if (user) t += `<circle class="user-glow" cx="0" cy="-74" r="58" fill="url(#i-glow)" opacity="0"/>`;
    t += `${p.s > 0.6 ? sway() : TREE_USE}</g>`;
  });
  return `<svg class="view" id="inside" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="i-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-300" x2="0" y2="170"><stop offset="0" stop-color="#A8B9B0"/><stop offset="1" stop-color="#F3D9A8"/></linearGradient>
    <linearGradient id="i-grass" gradientUnits="userSpaceOnUse" x1="0" y1="160" x2="0" y2="720"><stop offset="0" stop-color="#8A9A55"/><stop offset=".5" stop-color="#5F7A3C"/><stop offset="1" stop-color="#3F5A2E"/></linearGradient>
    ${brickPattern('i-brick', 20, 10)}
    <radialGradient id="i-glow"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".95"/><stop offset=".5" stop-color="#E3A33B" stop-opacity=".55"/><stop offset="1" stop-color="#E3A33B" stop-opacity="0"/></radialGradient>
    <linearGradient id="i-ray" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3D6" stop-opacity=".55"/><stop offset="1" stop-color="#FFF3D6" stop-opacity="0"/></linearGradient>
    <linearGradient id="i-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7B65A" stop-opacity=".55"/><stop offset=".55" stop-color="#E3A33B" stop-opacity=".18"/><stop offset="1" stop-color="#8B3A2B" stop-opacity=".25"/></linearGradient>
  </defs>
  <g class="cam">
    <rect x="-800" y="-700" width="2400" height="880" fill="url(#i-sky)"/>
    <circle cx="560" cy="60" r="140" fill="#FFE9B8" opacity=".45"/>
    <rect x="-800" y="104" width="2400" height="66" fill="url(#i-brick)"/>
    <rect x="-800" y="104" width="2400" height="66" fill="#1A0D08" opacity=".12"/>
    <rect x="-800" y="98" width="2400" height="8" fill="#A65441"/>
    <path d="M380 170 V140 A20 20 0 0 1 420 140 V170Z" fill="#E7CC94"/>
    <path d="M380 170 V140 A20 20 0 0 1 420 140 V170" stroke="#3A2A1E" stroke-width="2.5" fill="none"/>
    <rect x="368" y="132" width="10" height="38" fill="#6B4423"/><rect x="422" y="132" width="10" height="38" fill="#6B4423"/>
    <rect x="-800" y="168" width="2400" height="900" fill="url(#i-grass)"/>
    <g class="trees">${t}</g>
    <g id="gardener" opacity="0" transform="translate(318 606)">
      <ellipse cx="0" cy="1" rx="22" ry="5" fill="#000" opacity=".2"/>
      <g>${reduced ? '' : '<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.4;0 0" dur="3.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>'}
      <path d="M-15 0 L-12 -40 H12 L15 0Z" fill="#2E5537"/>
      <path d="M-9 -38 H9 L11 -6 H-11Z" fill="#F4EBDD"/>
      <rect x="-10" y="-62" width="20" height="24" rx="6" fill="#2E5537"/>
      <circle cx="0" cy="-70" r="9" fill="#D9A47C"/>
      <ellipse cx="0" cy="-77" rx="18" ry="4" fill="#D8B26A"/>
      <path d="M-9 -77 C-9 -90 9 -90 9 -77Z" fill="#C9A156"/>
      <circle cx="-3" cy="-70" r="1" fill="#1A1714"/><circle cx="3" cy="-70" r="1" fill="#1A1714"/>
      <path d="M-3 -66 Q0 -64 3 -66" stroke="#1A1714" stroke-width=".9" fill="none"/>
      <path d="M12 -52 C22 -46 24 -36 20 -30" stroke="#2E5537" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M14 -30 h14 l-3 12 h-8z" fill="#8A5A34"/>
      <circle cx="18" cy="-31" r="3.2" fill="#E3A33B"/><circle cx="24" cy="-32" r="3.2" fill="#E3A33B"/>
      </g>
    </g>
    <g class="fruits"></g>
    ${motes(26, 60, 760, 40, 560)}
    <g class="rays" pointer-events="none" opacity=".5">
      <path d="M560 40 L60 700 L220 700 Z" fill="url(#i-ray)" opacity=".3"/>
      <path d="M560 40 L420 700 L540 700 Z" fill="url(#i-ray)" opacity=".24"/>
    </g>
    <rect id="golden" x="-800" y="-700" width="2400" height="1800" fill="url(#i-gold)" opacity="0" pointer-events="none"/>
  </g>
</svg>`;
}

function layoutOrchard() {
  const rows = 10;
  const cols = 12;
  const out: { x: number; y: number; s: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const s = 0.3 + 0.7 * t;
    const y = 186 + 400 * Math.pow(t, 1.25);
    for (let c = 0; c < cols; c++) {
      const x = 400 + (c - (cols - 1) / 2) * 90 * s + rnd(-5, 5) * s;
      out.push({ x, y, s });
    }
  }
  return out;
}

export function createWorld(host: HTMLElement, stage: HTMLElement, panel: HTMLElement, fx: (cue: Cue) => void = () => {}) {
  const layout = layoutOrchard();
  const userIdx = 6 * 12 + 4 + Math.floor(Math.random() * 4);
  host.insertAdjacentHTML('beforeend', outsideSvg() + insideSvg(layout, userIdx));

  const q = <T extends Element = SVGGElement>(sel: string) => host.querySelector<T>(sel)!;
  const svgs = { outside: q<SVGSVGElement>('#outside'), inside: q<SVGSVGElement>('#inside') };
  const trees: TreeSlot[] = Array.from(host.querySelectorAll<SVGGElement>('.otree')).map((el, i) => ({
    ...layout[i],
    el,
  }));
  const user = trees[userIdx];
  const fruitLayer = q('#inside .fruits');
  const ofx = q('#outside .ofx');
  const el = {
    doorL: q('#door-l'),
    doorR: q('#door-r'),
    lock: q('#lock'),
    shackle: q<SVGPathElement>('#shackle'),
    key: q('#gkey'),
    keyTurn: q('#gkey-turn'),
    stranger: q('#stranger'),
    strangerBody: q('#stranger-body'),
    ftree: q('#ftree'),
    ftreeS: q('#ftree-s'),
    fsign: q('#fsign'),
    fsignTilt: q('#fsign-tilt'),
    fsignT: q<SVGTextElement>('#fsign-t'),
    isap: q('#isap'),
    stall: q('#stall'),
    stallSign: q('#stall-sign'),
    stallT: q<SVGTextElement>('#stall-t'),
    ofruit: q<SVGCircleElement>('#ofruit'),
    gardener: q('#gardener'),
    golden: q('#golden'),
  };

  // Field tree and sign are positioned with GSAP so later tweens stay absolute.
  gsap.set(el.ftree, { x: 300, y: 528 });
  gsap.set(el.fsign, { x: 348, y: 530 });

  let current: View = 'outside';
  gsap.set(svgs.inside, { autoAlpha: 0 });
  svgs.inside.pauseAnimations();
  // Let the trees rest while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    const v = svgs[current];
    if (document.hidden) v.pauseAnimations();
    else v.unpauseAnimations();
  });

  // ---------- Camera ----------
  function freeRect(area: Area) {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (area === 'hero') return { x: 0, y: H * 0.5, w: W, h: H * 0.5 };
    if (panel.hidden) return { x: 0, y: 0, w: W, h: H };
    const sr = stage.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    if (pr.width < W * 0.6) {
      const left = pr.right - sr.left;
      return { x: left, y: 0, w: Math.max(200, W - left), h: H };
    }
    const top = pr.top - sr.top;
    return { x: 0, y: 6, w: W, h: Math.max(150, top - 6) };
  }

  const cams = (Object.keys(svgs) as View[]).reduce(
    (acc, v) => {
      const g = svgs[v].querySelector<SVGGElement>('.cam')!;
      const cur = { tx: 0, ty: 0, s: 1 };
      acc[v] = { g, cur, box: BOX.hero as Box, area: 'auto' as Area };
      return acc;
    },
    {} as Record<View, { g: SVGGElement; cur: { tx: number; ty: number; s: number }; box: Box; area: Area }>,
  );

  function solve(box: Box, area: Area) {
    const W = stage.clientWidth || 1;
    const H = stage.clientHeight || 1;
    const k = Math.max(W / 800, H / 600);
    const offX = (W - 800 * k) / 2;
    const offY = (H - 600 * k) / 2;
    const f = freeRect(area);
    const s = Math.min(2.6, Math.max(0.3, Math.min(f.w / (k * box.w), f.h / (k * box.h))));
    return {
      tx: (f.x + f.w / 2 - offX) / k - s * box.x,
      ty: (f.y + f.h / 2 - offY) / k - s * box.y,
      s,
    };
  }

  const applyCam = (v: View) => {
    const { g, cur } = cams[v];
    g.setAttribute('transform', `translate(${cur.tx.toFixed(2)} ${cur.ty.toFixed(2)}) scale(${cur.s.toFixed(4)})`);
  };

  function frame(box: Box, opts: { dur?: number; ease?: string; area?: Area; view?: View } = {}) {
    const v = opts.view ?? current;
    const c = cams[v];
    c.box = box;
    c.area = opts.area ?? 'auto';
    const target = solve(box, c.area);
    const dur = opts.dur ?? 1.4;
    gsap.killTweensOf(c.cur);
    if (dur === 0 || v !== current) {
      Object.assign(c.cur, target);
      applyCam(v);
      return Promise.resolve();
    }
    if (reduced) {
      // Big camera moves become a quick fade.
      return new Promise<void>((done) => {
        gsap.to(svgs[v], {
          opacity: 0.35,
          duration: 0.15,
          onComplete: () => {
            Object.assign(c.cur, target);
            applyCam(v);
            gsap.to(svgs[v], { opacity: 1, duration: 0.2, onComplete: () => done() });
          },
        });
      });
    }
    if (dur >= 1.4) fx('whoosh');
    return gsap
      .to(c.cur, { ...target, duration: dur, ease: opts.ease ?? 'power4.inOut', onUpdate: () => applyCam(v) })
      .then(() => undefined);
  }

  function refresh(dur = 0.5) {
    (Object.keys(cams) as View[]).forEach((v) => {
      const c = cams[v];
      const target = solve(c.box, c.area);
      gsap.killTweensOf(c.cur);
      if (v !== current || dur === 0 || reduced) {
        Object.assign(c.cur, target);
        applyCam(v);
      } else gsap.to(c.cur, { ...target, duration: dur, ease: 'power2.out', onUpdate: () => applyCam(v) });
    });
  }

  new ResizeObserver(() => refresh(0)).observe(stage);
  let panelH = 0;
  new ResizeObserver(() => {
    const h = Math.round(panel.getBoundingClientRect().height);
    if (Math.abs(h - panelH) > 24) {
      panelH = h;
      refresh(0.6);
    }
  }).observe(panel);

  function view(v: View, fade = 0.7) {
    if (v === current) return Promise.resolve();
    const from = svgs[current];
    current = v;
    applyCam(v);
    svgs[v].unpauseAnimations();
    setTimeout(() => current !== (from.id as View) && from.pauseAnimations(), fade * 1000 + 50);
    gsap.to(from, { autoAlpha: 0, duration: d(fade), ease: 'power1.inOut' });
    return gsap.to(svgs[v], { autoAlpha: 1, duration: d(fade), ease: 'power1.inOut' }).then(() => undefined);
  }

  /** Open onto the other view through a growing circle at a stage point. */
  function iris(v: View, at: { x: number; y: number }, dur = 1.4) {
    if (reduced || v === current) return view(v, 0.4);
    const from = svgs[current];
    const to = svgs[v];
    current = v;
    applyCam(v);
    to.unpauseAnimations();
    const R = Math.hypot(stage.clientWidth, stage.clientHeight) * 1.1;
    const p = { r: 0 };
    const set = () => (to.style.clipPath = `circle(${p.r.toFixed(1)}px at ${at.x.toFixed(1)}px ${at.y.toFixed(1)}px)`);
    set();
    gsap.set(to, { autoAlpha: 1 });
    return gsap
      .to(p, {
        r: R,
        duration: dur,
        ease: 'expo.inOut',
        onUpdate: set,
        onComplete: () => {
          to.style.clipPath = '';
          gsap.set(from, { autoAlpha: 0 });
          from.pauseAnimations();
        },
      })
      .then(() => undefined);
  }

  /** A warm bloom of light at a stage point. */
  function burst(at: { x: number; y: number }) {
    if (reduced) return;
    const b = document.createElement('div');
    b.className = 'burst';
    b.style.left = `${at.x}px`;
    b.style.top = `${at.y}px`;
    host.append(b);
    gsap.fromTo(b, { scale: 0.2, opacity: 0 }, { scale: 9, opacity: 1, duration: 0.9, ease: 'expo.out' });
    gsap.to(b, { opacity: 0, duration: 1.1, delay: 0.55, ease: 'power2.out', onComplete: () => b.remove() });
  }

  function stagePoint(e: Element) {
    const r = e.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top };
  }

  const NS = 'http://www.w3.org/2000/svg';
  /** Particles flung from a point: soil, leaves, juice, light. */
  function sparks(layer: Element, x: number, y: number, n: number, colors: string[], spread: number, size: number) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', String(size * (0.5 + Math.random() * 0.7)));
      c.setAttribute('fill', colors[i % colors.length]);
      layer.append(c);
      const a = -Math.PI * (0.1 + Math.random() * 0.8);
      const dist = spread * (0.4 + Math.random() * 0.8);
      gsap.set(c, { x, y });
      gsap.to(c, { x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, duration: 0.55 + Math.random() * 0.35, ease: 'expo.out' });
      gsap.to(c, { y: `+=${spread * 0.6}`, opacity: 0, scale: 0.3, duration: 0.6, delay: 0.35, ease: 'power2.in', onComplete: () => c.remove() });
    }
  }

  // ---------- Gate ----------
  function doors(open: boolean, dur = 1) {
    gsap.to(el.doorL, { scaleX: open ? 0.14 : 1, transformOrigin: '0% 50%', duration: d(dur), ease: 'power2.inOut' });
    return gsap
      .to(el.doorR, { scaleX: open ? 0.14 : 1, transformOrigin: '100% 50%', duration: d(dur), ease: 'power2.inOut' })
      .then(() => undefined);
  }

  function rattle() {
    if (reduced) return Promise.resolve();
    const tl = gsap.timeline();
    tl.to([el.doorL, el.doorR], { x: 1.6, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' })
      .to([el.doorL, el.doorR], { x: 0, duration: 0.05 })
      .to(el.lock, { rotation: 14, transformOrigin: '50% 0%', duration: 0.08, repeat: 5, yoyo: true }, 0)
      .to(el.lock, { rotation: 0, duration: 0.1 });
    return tl.then(() => undefined);
  }

  function setLocked(locked: boolean) {
    gsap.killTweensOf([el.lock, el.shackle, el.key, el.keyTurn]);
    gsap.set(el.lock, { autoAlpha: locked ? 1 : 0, y: 0, x: 0, rotation: 0 });
    gsap.set(el.shackle, { y: 0 });
    gsap.set(el.key, { autoAlpha: 0 });
    gsap.set(el.keyTurn, { rotation: 0 });
  }

  function turnKey() {
    setLocked(true);
    const tl = gsap.timeline();
    tl.fromTo(el.key, { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: d(0.7), ease: 'power3.out' })
      .to(el.keyTurn, { rotation: 90, transformOrigin: '0% 50%', duration: d(0.45), ease: 'back.out(2)' }, '+=0.15')
      .add('clunk')
      .to(el.shackle, { y: -4, duration: d(0.15) }, 'clunk')
      .to(el.lock, { y: 70, rotation: 40, autoAlpha: 0, duration: d(0.7), ease: 'power2.in' }, 'clunk+=0.35')
      .to(el.key, { autoAlpha: 0, duration: d(0.4) }, 'clunk+=0.35');
    return tl;
  }

  // ---------- Field ----------
  const sizeFor = (amount: number) => 0.45 + (0.65 * (Math.log10(amount) + 2)) / 3;

  function setSign(text: string) {
    el.fsignT.textContent = text;
  }

  async function plantField(amount: number, label: string): Promise<void> {
    gsap.killTweensOf([el.ftree, el.ftreeS, el.fsign, el.fsignTilt]);
    gsap.set(el.ftree, { x: 300, y: 528, autoAlpha: 1 });
    gsap.set(el.fsign, { x: 348, y: 530 });
    gsap.set(el.fsignTilt, { rotation: 0, y: 0 });
    setSign(label);
    fx('thud');
    sparks(ofx, 300, 528, 14, ['#6B4A2E', '#8A6440', '#4A3220', '#3E6B45'], 34, 2.2);
    gsap.fromTo(el.ftreeS, { scale: 0.05 }, { scale: sizeFor(amount), duration: d(1.4), ease: 'elastic.out(1, 0.55)', transformOrigin: '50% 100%' });
    setTimeout(() => fx('rustle'), 250);
    await gsap.fromTo(el.fsign, { autoAlpha: 0, y: 490, rotation: -8 }, { autoAlpha: 1, y: 530, rotation: 0, duration: d(0.7), delay: d(0.55), ease: 'bounce.out' });
  }

  function setFieldSize(amount: number, label: string) {
    setSign(label);
    gsap.to(el.ftreeS, { scale: sizeFor(amount), duration: d(0.4), ease: 'power2.out', transformOrigin: '50% 100%' });
  }

  function showField(amount: number, label: string) {
    gsap.killTweensOf([el.ftree, el.ftreeS, el.fsign, el.fsignTilt]);
    gsap.set(el.ftree, { x: 300, y: 528, autoAlpha: 1 });
    gsap.set(el.ftreeS, { scale: sizeFor(amount), transformOrigin: '50% 100%' });
    gsap.set(el.fsign, { x: 348, y: 530, autoAlpha: 1 });
    gsap.set(el.fsignTilt, { rotation: 0, y: 0 });
    setSign(label);
  }

  function hideField() {
    gsap.killTweensOf([el.ftree, el.fsign]);
    gsap.set([el.ftree, el.fsign], { autoAlpha: 0 });
  }

  // ---------- Orchard ----------
  const crown = (t: { x: number; y: number; s: number }) => ({ x: t.x, y: t.y - 78 * t.s });

  function setUserPlanted(on: boolean) {
    gsap.killTweensOf(user.el);
    gsap.set(user.el, { autoAlpha: on ? 1 : 0, x: user.x, y: user.y, scale: user.s });
    gsap.set(user.el.querySelector('.user-glow'), { opacity: 0 });
  }
  // Keep GSAP in charge of every tree transform.
  trees.forEach((t) => gsap.set(t.el, { x: t.x, y: t.y, scale: t.s }));

  /** Every nearby tree answers when a new one arrives: you are one of many. */
  function ripple(center: TreeSlot) {
    if (reduced) return;
    fx('rustle');
    trees.forEach((t) => {
      if (t === center) return;
      const dist = Math.hypot(t.x - center.x, (t.y - center.y) * 1.8);
      if (dist > 520) return;
      gsap.to(t.el, {
        scaleY: t.s * 1.05,
        scaleX: t.s * 0.985,
        duration: 0.22,
        delay: dist / 700,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    });
  }

  async function shield() {
    const tl = gsap.timeline();
    // Doors swing in, the sign gives way, the tree is pulled up by the roots.
    tl.to(el.doorL, { scaleX: 0.14, transformOrigin: '0% 50%', duration: d(1.5), ease: 'power3.inOut' }, 0)
      .to(el.doorR, { scaleX: 0.14, transformOrigin: '100% 50%', duration: d(1.5), ease: 'power3.inOut' }, 0)
      .to(el.fsignTilt, { rotation: 84, y: 6, transformOrigin: '50% 100%', duration: d(0.7), ease: 'bounce.out' }, 0.35)
      .to(el.fsign, { autoAlpha: 0, duration: d(0.5) }, 1.1)
      .to(el.ftree, { x: '+=1.6', duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, 0.5)
      .call(() => sparks(ofx, 300, 528, 18, ['#6B4A2E', '#8A6440', '#4A3220'], 40, 2.4), [], 0.95)
      .to(el.ftree, { y: '-=30', duration: d(0.8), ease: 'expo.out' }, 0.95)
      .to(el.ftree, { x: 400, y: 448, duration: d(1.5), ease: 'power3.inOut' }, 1.5)
      .to(el.ftreeS, { scale: 0.45, duration: d(1.5), ease: 'power3.inOut' }, 1.5);
    frame(BOX.gate, { dur: 2.6, ease: 'power3.inOut' });
    await tl;
    const gatePt = stagePoint(q('[clip-path="url(#o-arch)"]'));
    gsap.to(el.ftree, { autoAlpha: 0, duration: d(0.35) });
    burst(gatePt);
    frame(BOX.gateTight, { dur: 0.9, ease: 'power3.in' });

    // Through the gate: an iris opens onto the orchard.
    frame(BOX.backGate, { dur: 0, view: 'inside' });
    gsap.set(user.el, { autoAlpha: 1, x: 400, y: 172, scale: 0.16 });
    await iris('inside', gatePt, 1.5);
    const g = gsap.timeline();
    g.to(user.el, { y: 150, duration: d(0.45), ease: 'expo.out' })
      .to(user.el, { x: user.x, y: user.y - 6, scale: user.s, duration: d(1.6), ease: 'expo.inOut' })
      .to(user.el, { y: user.y, scaleY: user.s * 0.86, scaleX: user.s * 1.08, duration: d(0.12), ease: 'power2.in' })
      .call(() => {
        fx('shimmer');
        sparks(fruitLayer, user.x, user.y, 16, ['#F2D28B', '#E3A33B', '#FFF3D6'], 70 * user.s, 3 * user.s);
        ripple(user);
      })
      .to(user.el, { scaleY: user.s, scaleX: user.s, duration: d(0.9), ease: 'elastic.out(1, 0.4)' });
    frame(BOX.orchard, { dur: 3.2, ease: 'power3.inOut' });
    await g;
    hideField();
  }

  function onTreeTap(cb: (i: number) => void) {
    const handler = (e: Event) => {
      const t = (e.target as Element).closest<SVGGElement>('.otree');
      if (!t) return;
      const i = Number(t.dataset.i);
      if (!reduced) {
        gsap.fromTo(t, { rotation: -4 }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.3)', transformOrigin: '50% 100%' });
        const tc = crown(trees[i]);
        sparks(fruitLayer, tc.x, tc.y, 7, ['#3E6B45', '#55894F', '#2E5537'], 40 * trees[i].s, 2.6 * trees[i].s);
      }
      fx('rustle');
      puff(trees[i]);
      cb(i);
    };
    svgs.inside.addEventListener('click', handler);
    svgs.inside.classList.add('is-tappable');
    return () => {
      svgs.inside.removeEventListener('click', handler);
      svgs.inside.classList.remove('is-tappable');
    };
  }

  function puff(t: TreeSlot) {
    const c = crown(t);
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.textContent = '?';
    txt.setAttribute('class', 'svg-q');
    txt.setAttribute('x', String(c.x));
    txt.setAttribute('y', String(c.y - 40 * t.s));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', String(Math.max(14, 30 * t.s)));
    fruitLayer.append(txt);
    gsap.fromTo(txt, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: -10, duration: d(0.4), ease: 'power2.out' });
    gsap.to(txt, { autoAlpha: 0, duration: 0.4, delay: 0.9, onComplete: () => txt.remove() });
  }

  function focusUser() {
    return frame({ x: user.x, y: user.y - 60 * user.s, w: 300, h: 230 }, { dur: 1.2 });
  }

  function glowUser() {
    const glow = user.el.querySelector('.user-glow')!;
    const tl = gsap.timeline();
    tl.to(glow, { opacity: 1, duration: d(0.5), ease: 'power2.out' })
      .to(user.el, { scale: user.s * 1.08, duration: d(0.4), yoyo: true, repeat: 1, ease: 'power2.inOut' }, 0)
      .to(glow, { opacity: 0, duration: d(1.2), delay: 1.8 });
    return tl;
  }

  function makeFruit(x: number, y: number, r: number) {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<circle r="${r}" fill="#E3A33B" stroke="#A86E1C" stroke-width="${r * 0.14}"/><circle cx="${-r * 0.35}" cy="${-r * 0.35}" r="${r * 0.32}" fill="#FFE3A0" opacity=".8"/><path d="M0 ${-r} q${r * 0.2} ${-r * 0.6} ${r * 0.7} ${-r * 0.75}" stroke="#4A3220" stroke-width="${r * 0.18}" fill="none" stroke-linecap="round"/><ellipse cx="${r * 0.55}" cy="${-r * 1.45}" rx="${r * 0.45}" ry="${r * 0.22}" fill="#3E6B45" transform="rotate(-25 ${r * 0.55} ${-r * 1.45})"/>`;
    fruitLayer.append(g);
    gsap.set(g, { x, y });
    return g;
  }

  /** Squash on impact, juice, a soft pluck, then settle. */
  function land(f: Element, layer: Element, x: number, y: number, r: number) {
    fx('pluck');
    sparks(layer, x, y, 9, ['#F2D28B', '#E3A33B', '#FFF3D6'], r * 7, r * 0.35);
    return gsap
      .timeline()
      .to(f, { scaleX: 1.35, scaleY: 0.68, duration: d(0.07), ease: 'power2.out' })
      .to(f, { scaleX: 1, scaleY: 1, duration: d(0.6), ease: 'elastic.out(1.1, 0.35)' });
  }

  /** Arc a fruit between two points, peaking `lift` units above. */
  function arc(target: Element, from: { x: number; y: number }, to: { x: number; y: number }, lift: number, dur: number) {
    const p = { t: 0 };
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - lift;
    return gsap.to(p, {
      t: 1,
      duration: d(dur),
      ease: 'power2.inOut',
      onUpdate: () => {
        const u = 1 - p.t;
        gsap.set(target, {
          x: u * u * from.x + 2 * u * p.t * cx + p.t * p.t * to.x,
          y: u * u * from.y + 2 * u * p.t * cy + p.t * p.t * to.y,
        });
      },
    });
  }

  async function unshieldFruit(label: string) {
    el.stallT.textContent = label;
    gsap.set(el.stallSign, { autoAlpha: 0 });
    // A random tree, never visibly the user's.
    const others = trees.filter((t, i) => i !== userIdx && t.s > 0.45 && Math.abs(t.x - 400) < 230);
    const src = others[Math.floor(Math.random() * others.length)];
    const c = crown(src);
    const f = makeFruit(c.x, c.y, 5 * src.s);
    const tl = gsap.timeline();
    tl.fromTo(f, { scale: 0 }, { scale: 1, duration: d(0.3), ease: 'back.out(2)' })
      .to(f, { y: src.y - 2, duration: d(0.55), ease: 'power2.in' })
      .add(() => { land(f, fruitLayer, c.x, src.y - 2, 5 * src.s); })
      .add(arc(f, { x: c.x, y: src.y - 2 }, { x: 400, y: 168 }, 60, 1.4))
      .to(f, { scale: 0.4, duration: d(1.4) }, '<')
      .to(f, { autoAlpha: 0, duration: d(0.2) });
    frame(BOX.backGate, { dur: 2.2 });
    await tl;
    f.remove();

    gsap.set([el.doorL, el.doorR], { scaleX: 0.14 });
    hideField();
    gsap.set(el.stall, { autoAlpha: 1 });
    frame(BOX.gateTight, { dur: 0, view: 'outside' });
    await view('outside', 0.5);
    frame(BOX.stall, { dur: 1.6, ease: 'power2.inOut' });
    gsap.set(el.ofruit, { x: 400, y: 434, autoAlpha: 1, scale: 0.4 });
    burst(stagePoint(q('[clip-path="url(#o-arch)"]')));
    const out = gsap.timeline();
    out.to(el.ofruit, { scale: 1, duration: d(0.4) })
      .add(arc(el.ofruit, { x: 400, y: 434 }, { x: 512, y: 492 }, 40, 1.1))
      .add(() => { land(el.ofruit, ofx, 512, 492, 5.5); })
      .to({}, { duration: d(0.4) })
      .fromTo(el.stallSign, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: d(0.5), ease: 'bounce.out' });
    await out;
  }

  function setStall(on: boolean, label?: string) {
    if (label) el.stallT.textContent = label;
    gsap.set(el.stall, { autoAlpha: on ? 1 : 0 });
    gsap.set(el.stallSign, { autoAlpha: on && label ? 1 : 0 });
    gsap.set(el.ofruit, { autoAlpha: on && label ? 1 : 0, x: 512, y: 492, scale: 1 });
  }

  // The Gardener's tree: a front-row tree beside them.
  const gardenerTree = trees.reduce((best, t) => (t.s > 0.95 && Math.abs(t.x - 360) < Math.abs(best.x - 360) ? t : best), trees[trees.length - 1]);

  async function gardener(on: boolean): Promise<void> {
    await gsap.to(el.gardener, { autoAlpha: on ? 1 : 0, duration: d(0.5) });
  }

  async function passFruit(dir: 'send' | 'receive') {
    const a = crown(dir === 'send' ? user : gardenerTree);
    const b = crown(dir === 'send' ? gardenerTree : user);
    const f = makeFruit(a.x, a.y, 7);
    const tl = gsap.timeline();
    tl.fromTo(f, { scale: 0 }, { scale: 1, duration: d(0.45), ease: 'elastic.out(1, 0.45)' })
      .to(f, { scaleY: 0.8, scaleX: 1.15, duration: d(0.12), ease: 'power2.in' })
      .to(f, { scaleY: 1.1, scaleX: 0.92, duration: d(0.12) })
      .add(arc(f, a, b, 130, 1.9))
      .add(() => { land(f, fruitLayer, b.x, b.y, 7); })
      .to(f, { scale: 0, opacity: 0, duration: d(0.35), delay: 0.45, ease: 'power2.in' });
    await tl;
    f.remove();
  }

  async function golden() {
    frame(BOX.low, { dur: 0 });
    gsap.set(el.golden, { opacity: 0 });
    gsap.to(el.golden, { opacity: 1, duration: d(2.6), ease: 'power1.inOut' });
    await frame(BOX.golden, { dur: 3, ease: 'power2.inOut' });
  }

  function reset() {
    gsap.set([el.doorL, el.doorR], { scaleX: 1, x: 0 });
    setLocked(true);
    gsap.set([el.stranger, el.isap], { autoAlpha: 0 });
    hideField();
    setStall(false);
    setUserPlanted(false);
    gsap.set([el.gardener, el.golden], { opacity: 0 });
    fruitLayer.replaceChildren();
  }

  return {
    BOX,
    get view() {
      return current;
    },
    show: view,
    frame,
    refresh,
    doors,
    rattle,
    setLocked,
    turnKey,
    stranger(on: boolean) {
      return gsap.to(el.stranger, { autoAlpha: on ? 1 : 0, x: on ? 484 : 500, duration: d(0.6), ease: 'power2.out' });
    },
    strangerLaugh() {
      if (reduced) return;
      gsap.fromTo(el.strangerBody, { y: 0 }, { y: -3, duration: 0.09, repeat: 9, yoyo: true, ease: 'none' });
    },
    plantField,
    setFieldSize,
    showField,
    hideField,
    insideSapling(on: boolean) {
      return gsap.to(el.isap, { autoAlpha: on ? 1 : 0, duration: d(0.8) });
    },
    setUserPlanted,
    shield,
    onTreeTap,
    glowUser,
    focusUser,
    userIndex: userIdx,
    unshieldFruit,
    setStall,
    gardener,
    passFruit,
    golden,
    setGolden(on: boolean) {
      gsap.set(el.golden, { opacity: on ? 1 : 0 });
    },
    reset,
  };
}

export type World = ReturnType<typeof createWorld>;
