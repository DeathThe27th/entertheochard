import './style.css';
import gsap from 'gsap';
import { MEDIA } from './config';
import { reduced } from './motion';
import { enterOrchard, steps, type Ctx, type StepId } from './scenes';
import { createSound } from './sound';
import { createWatcher } from './watcher';
import { createWorld, type World } from './world';
import type { Cue } from './sound';

function webgl() {
  if (new URLSearchParams(location.search).has('2d')) return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

const app = $('#app');
const stage = $('#stage');
const panel = $('#panel');
const hero = $('#hero');
const backBtn = $<HTMLButtonElement>('#back-btn');
const soundBtn = $<HTMLButtonElement>('#sound-btn');
const guide = $<HTMLDialogElement>('#guide');
const progress = $('#progress');

const sound = createSound();
const fx = (cue: Cue) => sound.play(cue);
// 3D when the device can do it; the illustrated 2D world otherwise.
const use3d = webgl();
if (use3d) app.classList.add('is-3d');
const world: World = use3d ? (await import('./world3d')).createWorld3d($('#world'), stage, panel, fx) : createWorld($('#world'), stage, panel, fx);
const watcher = createWatcher($('#watcher'), { type: () => sound.play('type'), redact: () => sound.play('glitch') });

// ---------- Progress fruits ----------
const CHAPTERS = ['Key', 'Tree', 'Orchard', 'Fruit', 'Inside'];
const done = new Set<number>();
CHAPTERS.forEach((name, i) => {
  const li = document.createElement('li');
  li.className = 'fruit';
  li.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#fruit-icon"/></svg><span class="sr">Chapter ${i + 1}: ${name}</span>`;
  li.setAttribute('aria-label', `Chapter ${i + 1}, ${name}, not done`);
  progress.append(li);
});
function complete(chapter: number) {
  if (done.has(chapter)) return;
  done.add(chapter);
  sound.play('chime');
  const li = progress.children[chapter - 1] as HTMLElement;
  li.classList.add('is-done');
  li.setAttribute('aria-label', `Chapter ${chapter}, ${CHAPTERS[chapter - 1]}, done`);
  if (!reduced) gsap.fromTo(li, { scale: 0.5 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.3, 0.4)' });
}

// ---------- Step engine ----------
let current: StepId = 'gate';
let gen = 0;
let cleanup: (() => void) | void;
const history: StepId[] = [];
const isDesktop = () => matchMedia('(min-width: 900px) and (pointer: fine)').matches;

const ctx: Ctx = {
  world,
  watcher,
  sound,
  panel,
  goTo: (id) => goTo(id),
  complete,
  openGuide,
  setDemo: (on) => ($('#demo-chip').hidden = !on),
  isDesktop,
};

function goTo(id: StepId, push = true) {
  cleanup?.();
  if (push && id !== current) history.push(current);
  current = id;
  const mine = ++gen;
  backBtn.hidden = history.length === 0;
  sound.zone(id === 'inside' ? 'final' : ['unshield', 'send', 'receive'].includes(id) ? 'inside' : 'outside');
  cleanup = steps[id](ctx, () => mine === gen);
}

backBtn.addEventListener('click', () => {
  const prev = history.pop();
  if (prev) goTo(prev, false);
});

// ---------- Hero ----------
const video = $<HTMLVideoElement>('#hero-video');
if (!reduced) {
  video.addEventListener('canplay', () => {
    video.classList.add('is-ready');
    video.play().catch(() => {});
  });
  video.addEventListener('error', () => video.remove(), true);
  video.preload = 'auto';
  video.src = MEDIA.heroVideo;
} else video.remove();

$('#enter-btn').addEventListener('click', () => {
  sound.start();
  soundBtn.setAttribute('aria-pressed', 'true');
  app.classList.remove('is-pre');
  const leave = gsap.timeline({ onComplete: () => (hero.hidden = true) });
  if (reduced) leave.to(hero, { autoAlpha: 0, duration: 0.2 });
  else
    leave
      .to('.hero-title .ln > span', { yPercent: -110, duration: 0.7, ease: 'expo.in', stagger: 0.06 }, 0)
      .to(['.hero-kicker', '.hero-line', '#enter-btn'], { autoAlpha: 0, y: -14, duration: 0.45, ease: 'power2.in', stagger: 0.04 }, 0);
  if (video.isConnected) leave.to(video, { autoAlpha: 0, duration: 0.6 }, 0);
  enterOrchard(ctx);
});

// Intro: the headline settles in once fonts are ready.
document.fonts.ready.then(() => {
  app.classList.add('is-ready');
  if (reduced) return;
  const tl = gsap.timeline({ delay: 0.15 });
  tl.fromTo('.hero-title .ln > span', { yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12 })
    .fromTo('.hero-kicker', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out' }, 0.1)
    .fromTo(['.hero-line', '#enter-btn'], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, clearProps: 'transform,opacity,visibility' }, 0.55);
});

// ---------- Sound toggle ----------
soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
});

// ---------- Field Guide ----------
function openGuide() {
  if (!guide.open) guide.showModal();
}
$('#guide-btn').addEventListener('click', openGuide);
$('#guide-close').addEventListener('click', () => guide.close());
guide.addEventListener('click', (e) => {
  if (e.target === guide) guide.close();
});
if (location.hash === '#field-guide') openGuide();

// ---------- Tab visibility: let the trees rest ----------
document.addEventListener('visibilitychange', () => app.classList.toggle('is-hidden', document.hidden));

goTo('gate', false);

// Automated QA on slow software GPUs: keep animations on wall-clock time.
if (new URLSearchParams(location.search).has('qa')) gsap.ticker.lagSmoothing(0);

// Dev-only shortcut for QA: window.__go('send')
if (import.meta.env.DEV) Object.assign(window, { __gsap: gsap, __go: goTo, __enter: () => $('#enter-btn').click(), __orchard: () => enterOrchard(ctx), __world: world, __sound: sound });
