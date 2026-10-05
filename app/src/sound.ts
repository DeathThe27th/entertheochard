import { MEDIA } from './config';

export type Cue =
  | 'creak'
  | 'clunk'
  | 'pop'
  | 'pluck'
  | 'tick'
  | 'type'
  | 'whoosh'
  | 'chime'
  | 'glitch'
  | 'shimmer'
  | 'thud'
  | 'rustle'
  | 'doom'
  | 'jump'
  | 'boing'
  | 'pipe'
  | 'pipeUp'
  | 'spot'
  | 'flip';
export type Zone = 'outside' | 'inside' | 'final';

/**
 * Procedural sound design on the Web Audio API. Everything is synthesized,
 * so the site sounds finished with no media files. If optional files exist
 * in /media (birds, gate creak, pop) they are layered in instead.
 * Audio starts only after the Enter tap.
 */
export function createSound() {
  let on = false;
  let started = false;
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let dry: GainNode;
  let wet: GainNode;
  let amb: GainNode;
  let windGain: GainNode;
  let windFilter: BiquadFilterNode;
  let padGain: GainNode;
  let padFilter: BiquadFilterNode;
  let birdsGain: GainNode;
  let noise: AudioBuffer;
  let birdTimer = 0;
  let zone: Zone = 'outside';
  let lastType = 0;
  const files: Partial<Record<'birds' | 'creak' | 'pop', HTMLAudioElement>> = {};
  const ok = new WeakSet<HTMLAudioElement>();

  const load = (src: string, loop = false) => {
    const a = new Audio();
    a.preload = 'auto';
    a.loop = loop;
    a.addEventListener('canplaythrough', () => ok.add(a), { once: true });
    a.addEventListener('error', () => ok.delete(a));
    a.src = src;
    return a;
  };

  function makeNoise(c: AudioContext, seconds: number) {
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    // Pinkish noise (Paul Kellet's economy filter).
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return b;
  }

  function makeReverb(c: AudioContext, seconds: number, decay: number) {
    const len = c.sampleRate * seconds;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const conv = c.createConvolver();
    conv.buffer = b;
    return conv;
  }

  function init() {
    const c = new AudioContext();
    ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(c.destination);
    master = c.createGain();
    master.gain.value = 0;
    master.connect(comp);
    dry = c.createGain();
    dry.connect(master);
    const verb = makeReverb(c, 3.2, 2.6);
    wet = c.createGain();
    wet.gain.value = 0.32;
    wet.connect(verb).connect(master);
    noise = makeNoise(c, 4);

    amb = c.createGain();
    amb.gain.value = 1;
    amb.connect(dry);
    amb.connect(wet);

    // Wind: looping pink noise through a slowly breathing low-pass.
    const wind = c.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    windFilter = c.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.7;
    windGain = c.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(amb);
    wind.start();
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt).connect(windFilter.frequency);
    lfo.start();

    // Pad: a warm open fifth that blooms inside the orchard.
    padFilter = c.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 700;
    padGain = c.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain).connect(amb);
    for (const [f, det, type] of [
      [110, -5, 'sine'],
      [110, 5, 'triangle'],
      [164.81, 3, 'sine'],
      [220, -3, 'sine'],
      [277.18, 0, 'sine'],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = f > 250 ? 0.12 : 0.22;
      o.connect(g).connect(padFilter);
      o.start();
    }

    birdsGain = c.createGain();
    birdsGain.gain.value = 0;
    birdsGain.connect(dry);
    birdsGain.connect(wet);
    scheduleBird();
    applyZone(2);
  }

  // A short phrase of synthesized birdsong: FM-chirped sine bursts.
  function bird() {
    if (!ctx) return;
    const c = ctx;
    let t = c.currentTime + 0.05;
    const base = 2600 + Math.random() * 2200;
    const notes = 2 + Math.floor(Math.random() * 5);
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(birdsGain);
    for (let i = 0; i < notes; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      const dur = 0.05 + Math.random() * 0.09;
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() > 0.5 ? 1.35 : 0.72), t + dur);
      const fm = c.createOscillator();
      const fmg = c.createGain();
      fm.frequency.value = 40 + Math.random() * 60;
      fmg.gain.value = f * 0.04;
      fm.connect(fmg).connect(o.frequency);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(pan);
      o.start(t);
      fm.start(t);
      o.stop(t + dur + 0.02);
      fm.stop(t + dur + 0.02);
      t += dur + 0.03 + Math.random() * 0.08;
    }
  }

  function scheduleBird() {
    clearTimeout(birdTimer);
    birdTimer = window.setTimeout(() => {
      if (on && !document.hidden && !files.birds?.played.length) bird();
      scheduleBird();
    }, 1800 + Math.random() * 4200);
  }

  function applyZone(ramp = 1.5) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, ramp / 3);
    if (zone === 'outside') {
      set(windGain.gain, 0.22);
      set(padGain.gain, 0.0);
      set(birdsGain.gain, 0.9);
      set(padFilter.frequency, 500);
    } else if (zone === 'inside') {
      set(windGain.gain, 0.08);
      set(padGain.gain, 0.09);
      set(birdsGain.gain, 0.55);
      set(padFilter.frequency, 800);
    } else {
      set(windGain.gain, 0.06);
      set(padGain.gain, 0.14);
      set(birdsGain.gain, 0.7);
      set(padFilter.frequency, 1500);
    }
  }

  // ---------- Cue helpers ----------
  const env = (g: GainNode, t: number, peak: number, a: number, r: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  };
  const out = (send = 0.5) => {
    const g = ctx!.createGain();
    g.connect(dry);
    if (send > 0) {
      const s = ctx!.createGain();
      s.gain.value = send;
      g.connect(s).connect(wet);
    }
    return g;
  };
  const noiseBurst = (t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, send = 0.4, a = 0.01) => {
    const c = ctx!;
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = out(send);
    env(g, t, peak, a, dur);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 2);
    src.stop(t + a + dur + 0.05);
  };
  const tone = (t: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', send = 0.5, a = 0.005, glideTo?: number) => {
    const c = ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = out(send);
    env(g, t, peak, a, dur);
    o.connect(g);
    o.start(t);
    o.stop(t + a + dur + 0.05);
  };
  // Struck bell: inharmonic partials with fast decay on the highs.
  const bell = (t: number, f: number, peak: number) => {
    [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(t, f * m, 2.4 / (i + 1), peak / (i + 1.5), 'sine', 0.8, 0.003));
  };

  // ---------- Chiptune voice: square/triangle notes with hard 8-bit edges ----------
  const chip = (t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'square', glide?: number) => {
    const c = ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    const g = out(0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const run = (t: number, notes: number[], step: number, vol: number, type: OscillatorType = 'square', last = step) => {
    notes.forEach((f, i) => chip(t + i * step, f, i === notes.length - 1 ? last : step * 0.95, vol, type));
    return t + notes.length * step;
  };

  function synth(cue: Cue) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case 'creak': {
        // Wooden hinge: a resonant, wobbling rasp.
        const c = ctx;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(70, t);
        o.frequency.linearRampToValueAtTime(115, t + 0.35);
        o.frequency.linearRampToValueAtTime(82, t + 0.8);
        o.frequency.linearRampToValueAtTime(130, t + 1.3);
        o.frequency.linearRampToValueAtTime(60, t + 1.8);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 9;
        const g = out(0.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.15);
        g.gain.setValueAtTime(0.16, t + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
        o.connect(bp).connect(g);
        o.start(t);
        o.stop(t + 2);
        noiseBurst(t + 1.75, 0.5, 'lowpass', 400, 120, 1, 0.35, 0.5);
        break;
      }
      case 'clunk':
        tone(t, 95, 0.35, 0.5, 'sine', 0.3, 0.002, 48);
        noiseBurst(t, 0.12, 'bandpass', 2400, 900, 4, 0.35, 0.3, 0.001);
        tone(t + 0.02, 1840, 0.25, 0.05, 'triangle', 0.5);
        break;
      case 'pop':
      case 'pluck':
        // Two-note 8-bit blip: something landed.
        chip(t, 784, 0.06, 0.06);
        chip(t + 0.06, 1174.66, 0.16, 0.06);
        chip(t, 392, 0.2, 0.08, 'triangle');
        break;
      case 'jump':
        chip(t, 330, 0.16, 0.055, 'square', 880);
        break;
      case 'boing': {
        const c = ctx;
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(170, t);
        o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
        o.frequency.exponentialRampToValueAtTime(240, t + 0.38);
        const vib = c.createOscillator();
        const vg = c.createGain();
        vib.frequency.value = 22;
        vg.gain.value = 30;
        vib.connect(vg).connect(o.frequency);
        const g = out(0.2);
        env(g, t, 0.16, 0.005, 0.38);
        o.connect(g);
        o.start(t);
        vib.start(t);
        o.stop(t + 0.42);
        vib.stop(t + 0.42);
        break;
      }
      case 'pipe':
        // Warping down: a stepped, falling square cascade.
        run(t, [880, 740, 622, 523, 440, 370, 311, 262, 220], 0.045, 0.05);
        run(t, [220, 185, 156, 131, 110], 0.08, 0.07, 'triangle');
        break;
      case 'pipeUp':
        run(t, [220, 262, 311, 370, 440, 523, 622, 740, 880], 0.04, 0.05);
        break;
      case 'spot':
        // Watcher alarm: two-tone sweep, three times.
        for (let i = 0; i < 3; i++) {
          chip(t + i * 0.24, 988, 0.11, 0.045);
          chip(t + i * 0.24 + 0.12, 740, 0.11, 0.045);
        }
        tone(t, 98, 0.9, 0.12, 'sine', 0.4, 0.01);
        break;
      case 'flip':
        run(t, [1318.5, 1568, 2093], 0.035, 0.04);
        noiseBurst(t, 0.08, 'bandpass', 1800, 900, 3, 0.08, 0.2, 0.001);
        break;
      case 'tick':
        noiseBurst(t, 0.03, 'bandpass', 3800, 3000, 6, 0.08, 0.1, 0.001);
        break;
      case 'type': {
        const now = performance.now();
        if (now - lastType < 45) return;
        lastType = now;
        noiseBurst(t, 0.012, 'bandpass', 5200 + Math.random() * 1600, 5000, 8, 0.03, 0, 0.001);
        break;
      }
      case 'rustle':
        noiseBurst(t, 0.45, 'bandpass', 2600, 5200, 1.2, 0.09, 0.4, 0.04);
        break;
      case 'whoosh':
        noiseBurst(t, 1.1, 'bandpass', 220, 1600, 1.6, 0.14, 0.5, 0.45);
        break;
      case 'thud':
        tone(t, 80, 0.4, 0.35, 'sine', 0.3, 0.003, 42);
        noiseBurst(t, 0.25, 'lowpass', 600, 150, 1, 0.25, 0.3, 0.003);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) {
          const ti = t + i * 0.045 + Math.random() * 0.02;
          tone(ti, 300 + Math.random() * 1800, 0.03, 0.035, 'square', 0.05, 0.001);
        }
        break;
      case 'chime': {
        // Level clear: a bright 8-bit arpeggio over a triangle bass.
        const end = run(t, [523.25, 659.25, 783.99, 1046.5, 1318.5], 0.07, 0.05, 'square', 0.32);
        run(t, [130.81, 196, 261.63], 0.1, 0.09, 'triangle', 0.3);
        chip(end - 0.32, 1567.98, 0.32, 0.03, 'square');
        break;
      }
      case 'shimmer': {
        // The shielding moment: a slow swell of bells over a deep bloom.
        tone(t, 55, 3.5, 0.22, 'sine', 0.6, 1.2);
        [440, 554.37, 659.25, 830.61, 987.77, 1318.51].forEach((f, i) => bell(t + 0.25 + i * 0.16, f, 0.07));
        run(t + 0.2, [1046.5, 1318.5, 1568, 2093, 1568, 2093, 2637], 0.05, 0.03);
        noiseBurst(t, 2.6, 'highpass', 4000, 9000, 0.5, 0.05, 1, 1.4);
        break;
      }
      case 'doom':
        // Game over, 8-bit style: three falling steps and a sagging last note.
        run(t, [392, 370, 349.23], 0.26, 0.06);
        chip(t + 0.78, 329.63, 0.9, 0.06, 'square', 300);
        run(t, [98, 92.5, 87.3], 0.26, 0.1, 'triangle', 1);
        break;
    }
  }

  return {
    get on() {
      return on;
    },
    /** Call inside the Enter tap so iOS lets audio play. */
    start() {
      if (started) return;
      started = true;
      on = true;
      try {
        init();
        ctx!.resume().catch(() => {});
        master.gain.setTargetAtTime(0.9, ctx!.currentTime, 0.8);
      } catch {
        ctx = null;
      }
      files.birds = load(MEDIA.birds, true);
      files.birds.volume = 0.4;
      files.creak = load(MEDIA.creak);
      files.pop = load(MEDIA.pop);
      files.birds.play().catch(() => {});
    },
    toggle() {
      if (!started) {
        this.start();
        return on;
      }
      on = !on;
      if (files.birds && ok.has(files.birds)) {
        if (on) files.birds.play().catch(() => {});
        else files.birds.pause();
      }
      if (ctx) {
        if (on) ctx.resume().catch(() => {});
        master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.15);
      }
      return on;
    },
    zone(z: Zone) {
      if (z === zone) return;
      zone = z;
      applyZone();
    },
    /** Duck everything for the big moment, then let it breathe back in. */
    hush(seconds: number) {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      amb.gain.cancelScheduledValues(t);
      amb.gain.setTargetAtTime(0.04, t, 0.25);
      amb.gain.setTargetAtTime(1, t + seconds, 1.2);
    },
    play(cue: Cue) {
      if (!on) return;
      const f = cue === 'creak' ? files.creak : cue === 'pop' ? files.pop : undefined;
      if (f && ok.has(f)) {
        f.currentTime = 0;
        f.play().catch(() => synth(cue));
      } else synth(cue);
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
