import gsap from 'gsap';
import { reduced } from './motion';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const eyebrow = (text: string) => h('p', { class: 'eyebrow' }, text);
export const title = (text: string) => h('h2', { class: 'panel-title' }, text);
export const para = (text: string, cls = '') => h('p', { class: `copy ${cls}` }, text);
export const row = (...c: Child[]) => h('div', { class: 'row' }, ...c);

export function btn(label: string, onclick: () => void, variant: 'primary' | 'ghost' | 'link' = 'primary') {
  return h('button', { class: `btn btn-${variant}`, type: 'button', onclick }, label);
}

export function linkBtn(label: string, href: string, variant: 'primary' | 'ghost' = 'ghost') {
  return h('a', { class: `btn btn-${variant}`, href, target: '_blank', rel: 'noopener' }, label);
}

export function bubble(who: string, text: string, tone: 'stranger' | 'gardener' = 'gardener') {
  return h('div', { class: `bubble bubble-${tone}` }, h('span', { class: 'bubble-who' }, who), h('p', {}, text));
}

/** "Do it for real in Zodl" card, collapsed by default. */
export function realCard(steps: Child[], links: { label: string; href: string }[] = []) {
  return h(
    'details',
    { class: 'real' },
    h('summary', {}, h('span', { class: 'real-dot', 'aria-hidden': 'true' }), 'Do it for real in Zodl'),
    h('ol', {}, ...steps.map((s) => h('li', {}, s))),
    links.length ? h('p', { class: 'real-links' }, ...links.flatMap((l, i) => [i ? ' · ' : '', h('a', { href: l.href, target: '_blank', rel: 'noopener' }, l.label)])) : null,
  );
}

/** Replace the panel's content: the old lines lift away, the new ones rise in. */
export function fillPanel(panel: HTMLElement, children: Child[]) {
  panel.hidden = false;
  const old = panel.querySelector<HTMLElement>(':scope > .panel-inner:not(.panel-ghost)');
  const inner = h('div', { class: 'panel-inner' }, ...children);
  inner.querySelectorAll<HTMLElement>('.panel-title').forEach((t) => {
    const text = t.textContent ?? '';
    t.replaceChildren(h('span', { class: 'mask' }, h('span', {}, text)));
  });
  if (old && !reduced) {
    const ghost = old;
    ghost.classList.add('panel-ghost');
    Object.assign(ghost.style, { top: `${ghost.offsetTop - panel.scrollTop}px`, left: `${ghost.offsetLeft}px`, width: `${ghost.offsetWidth}px` });
    panel.scrollTop = 0;
    panel.append(inner);
    if (ghost.children.length) gsap.to(ghost.children, {
      autoAlpha: 0,
      y: -12,
      duration: 0.28,
      ease: 'power2.in',
      stagger: 0.03,
      onComplete: () => ghost.remove(),
    });
  } else {
    panel.replaceChildren(inner);
    panel.scrollTop = 0;
  }
  if (!reduced) {
    const delay = old ? 0.2 : 0;
    gsap.fromTo(inner.children, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay });
    const masks = inner.querySelectorAll('.mask > span');
    if (masks.length) gsap.fromTo(masks, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', delay: delay + 0.04 });
  }
  return inner;
}

/** Append more content to the current panel, animated, and bring it into view. */
export function appendPanel(panel: HTMLElement, children: Child[]) {
  const inner = panel.querySelector(':scope > .panel-inner:not(.panel-ghost)') ?? panel;
  const els = children.filter((c): c is Node => !!c && typeof c !== 'string') as HTMLElement[];
  els.forEach((e) => inner.append(e));
  if (!reduced) gsap.fromTo(els, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07 });
  requestAnimationFrame(() => panel.scrollTo({ top: panel.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }));
}

/** Press-and-hold button with a filling ring. Works with touch, mouse and keyboard. */
export function holdButton(label: string, onDone: () => void, ms = 1500, onTick?: () => void) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const ring = `<svg class="hold-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="hold-track"/><circle cx="50" cy="50" r="${R}" class="hold-fill" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`;
  const b = h('button', { class: 'hold', type: 'button', html: `${ring}<span class="hold-label">${label}</span>` });
  const fill = b.querySelector<SVGCircleElement>('.hold-fill')!;
  const p = { v: 0 };
  let tween: gsap.core.Tween | null = null;
  let done = false;
  let lastTick = 0;
  const render = () => {
    fill.style.strokeDashoffset = String(C * (1 - p.v));
    const step = Math.floor(p.v * 8);
    if (step > lastTick) {
      lastTick = step;
      onTick?.();
    }
  };
  const start = () => {
    if (done) return;
    b.classList.add('is-holding');
    tween?.kill();
    tween = gsap.to(p, {
      v: 1,
      duration: (ms / 1000) * (1 - p.v),
      ease: 'none',
      onUpdate: render,
      onComplete: () => {
        done = true;
        b.classList.remove('is-holding');
        b.classList.add('is-done');
        b.disabled = true;
        onDone();
      },
    });
  };
  const stop = () => {
    if (done) return;
    b.classList.remove('is-holding');
    tween?.kill();
    lastTick = 0;
    tween = gsap.to(p, { v: 0, duration: 0.35, ease: 'power2.out', onUpdate: render });
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    start();
  });
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointercancel', stop);
  b.addEventListener('lostpointercapture', stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      start();
    }
  });
  b.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') stop();
  });
  return b;
}

export const fmt = (a: number) => `${a.toFixed(2)} ZEC`;

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
/** A made-up transparent address for the simulation. Never a real one. */
export function fakeT() {
  let s = 't1';
  for (let i = 0; i < 33; i++) s += B58[(Math.random() * B58.length) | 0];
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
