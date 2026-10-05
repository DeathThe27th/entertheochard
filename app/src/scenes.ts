import gsap from 'gsap';
import { checkAddress, looksLikeSeed, shortAddr } from './address';
import { APP_STORE_URL, PLAY_STORE_URL, SHARE_TEXT, ZODL_EXCHANGE_GUIDE, ZODL_SITE, ZODL_SWAP_GUIDE } from './config';
import { reduced } from './motion';
import { qrSvg } from './qr';
import { saveShareCard } from './share';
import type { Sound } from './sound';
import { appendPanel, bubble, btn, eyebrow, fakeT, fillPanel, fmt, h, holdButton, linkBtn, para, realCard, row, title } from './ui';
import type { Watcher } from './watcher';
import type { World } from './world';

export type StepId = 'gate' | 'wallet' | 'stranger' | 'key' | 'plant' | 'shield' | 'unshield' | 'send' | 'receive' | 'inside';

export const state = {
  entered: false,
  address: '',
  short: '',
  kind: 'unified' as 'unified' | 'sapling' | 'demo',
  amount: 0.5,
  planted: false,
  memo: '',
  sendAmount: 0.05,
  tAddr: fakeT(),
  exAddr: fakeT(),
};

export interface Ctx {
  world: World;
  watcher: Watcher;
  sound: Sound;
  panel: HTMLElement;
  goTo(id: StepId): void;
  complete(chapter: number): void;
  openGuide(): void;
  setDemo(on: boolean): void;
  isDesktop(): boolean;
}

type Enter = (ctx: Ctx, live: () => boolean) => void | (() => void);

const NOISE = '▒▒▒▒▒▒▒▒▒▒';
const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).length;

/** Amount slider maps 0..100 onto 0.01..10 ZEC on a log scale. */
const toAmount = (v: number) => Math.max(0.01, Math.round(Math.pow(10, -2 + (3 * v) / 100) * 100) / 100);
const toSlider = (a: number) => Math.round(((Math.log10(a) + 2) / 3) * 100);

function amountSlider(onChange: (a: number) => void) {
  const out = h('output', { class: 'amount-out' }, fmt(state.amount));
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 1,
    value: toSlider(state.amount),
    class: 'slider',
    'aria-label': 'Amount of ZEC in the simulation',
  });
  input.addEventListener('input', () => {
    state.amount = toAmount(Number(input.value));
    out.textContent = fmt(state.amount);
    onChange(state.amount);
  });
  return h('label', { class: 'amount' }, h('span', { class: 'amount-label' }, 'Amount (pretend)'), out, input);
}

// ---------------------------------------------------------------- Scene 0
const gate: Enter = (ctx) => {
  const { world, panel } = ctx;
  world.show('outside', 0.3);
  world.setLocked(!state.address);
  world.doors(false, 0);
  world.stranger(false);
  world.hideField();
  world.setStall(false);
  if (!state.entered) {
    panel.hidden = true;
    world.frame(world.BOX.hero, { dur: 0, area: 'hero' });
    return;
  }
  fillPanel(panel, [
    eyebrow('The gate'),
    title("The gate's locked."),
    para("You'll need a key."),
    row(btn('Find a key', () => ctx.goTo('wallet'))),
  ]);
  requestAnimationFrame(() => world.frame(world.BOX.gate, { dur: 1.6 }).then(() => { world.rattle(); }));
};

export function enterOrchard(ctx: Ctx) {
  state.entered = true;
  ctx.watcher.clear('the gate');
  ctx.watcher.say("I'm the Watcher. I read the blockchain. Let's see what I can find out about you.");
  gate(ctx, () => true);
}

// ---------------------------------------------------------------- Scene 1
const wallet: Enter = (ctx) => {
  const { world, watcher } = ctx;
  world.show('outside', 0.3);
  world.setLocked(true);
  world.stranger(false);
  watcher.clear('chapter 1 · wallet');
  watcher.say('No wallet, no trail. Nothing to see yet.');

  const desktop = ctx.isDesktop();
  fillPanel(ctx.panel, [
    eyebrow('Chapter 1 · Forge your key'),
    title('Get your key'),
    para("Your key is a Zcash wallet. We'll use Zodl, a free app made by the team that built Zcash."),
    row(linkBtn('App Store', APP_STORE_URL || ZODL_SITE), linkBtn('Google Play', PLAY_STORE_URL || ZODL_SITE)),
    desktop
      ? h(
          'div',
          { class: 'qr-block' },
          h('div', { class: 'qr-wrap', html: qrSvg(ZODL_SITE) }),
          h('p', { class: 'small' }, 'On a computer? Scan this to open zodl.com on your phone.'),
        )
      : null,
    h(
      'ul',
      { class: 'tips' },
      h('li', {}, 'Create a new wallet.'),
      h('li', {}, 'Write the 24 words on paper.'),
      h('li', {}, 'Never screenshot them.'),
    ),
    row(btn("I've got my wallet", () => ctx.goTo('stranger'))),
  ]);
  requestAnimationFrame(() => world.frame(world.BOX.gate));
};

function keyArt() {
  return h('div', {
    class: 'key-art',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 120 60">
      <g class="kp"><circle cx="22" cy="30" r="14" fill="none" stroke="#E3A33B" stroke-width="7"/></g>
      <g class="kp"><rect x="35" y="26.5" width="22" height="7" rx="2" fill="#E3A33B"/></g>
      <g class="kp"><rect x="56" y="26.5" width="22" height="7" fill="#E3A33B"/></g>
      <g class="kp"><rect x="77" y="26.5" width="26" height="7" rx="2" fill="#E3A33B"/></g>
      <g class="kp"><rect x="86" y="33" width="6" height="11" fill="#E3A33B"/></g>
      <g class="kp"><rect x="96" y="33" width="6" height="8" fill="#E3A33B"/></g>
    </svg>`,
  });
}

const stranger: Enter = (ctx, live) => {
  const { world, watcher, panel } = ctx;
  world.show('outside', 0.3);
  world.setLocked(true);
  watcher.clear('chapter 1 · a stranger');
  watcher.say("Someone's at the wall. Not me. I just watch.");
  world.stranger(true);
  requestAnimationFrame(() => world.frame(world.BOX.wall));

  const choice = () => {
    fillPanel(panel, [
      eyebrow('Chapter 1 · Forge your key'),
      title('A stranger at the wall'),
      bubble('Stranger', "Hey, I'm from Zodl support. Something's wrong with your wallet. Read me your 24 words and I'll fix it.", 'stranger'),
      row(btn('Read him the words', lose, 'ghost'), btn('Refuse', win)),
    ]);
  };

  const lose = () => {
    world.strangerLaugh();
    ctx.sound.play('doom');
    const art = keyArt();
    fillPanel(panel, [
      art,
      title('You just lost everything.'),
      para('He has your words, so he has your wallet. In real life, that money is gone for good.'),
      row(btn('Try again', choice)),
    ]);
    watcher.say("Well, that was quick. He's already emptied it.");
    const parts = art.querySelectorAll('.kp');
    if (!reduced) {
      gsap
        .timeline({ delay: 0.3 })
        .to(art, { x: 3, duration: 0.05, repeat: 7, yoyo: true })
        .to(parts, {
          y: () => 14 + Math.random() * 12,
          x: () => -10 + Math.random() * 20,
          rotation: () => -120 + Math.random() * 240,
          autoAlpha: 0.4,
          duration: 0.9,
          ease: 'power2.in',
          stagger: 0.05,
          transformOrigin: '50% 50%',
        });
    } else gsap.set(parts, { autoAlpha: 0.25 });
  };

  const win = () => {
    world.stranger(false);
    ctx.sound.play('pluck');
    watcher.say("Smart. With those words he wouldn't need me. He'd just take it.");
    fillPanel(panel, [
      eyebrow('Chapter 1 · Forge your key'),
      title('Right.'),
      para('Nobody legit will ever ask for your words. Not support, not an exchange, not us.'),
      row(btn('Continue', () => live() && ctx.goTo('key'))),
    ]);
  };

  choice();
  return () => world.stranger(false);
};

const DEMO = { address: 'u1demo-not-a-real-address', short: 'u1dem…demo' };

const key: Enter = (ctx, live) => {
  const { world, watcher, panel, sound } = ctx;
  world.show('outside', 0.3);
  world.setLocked(true);
  world.doors(false, 0);
  watcher.clear('chapter 1 · your address');
  watcher.say("An address, huh? Let's see what it tells me.");
  requestAnimationFrame(() => world.frame(world.BOX.gate));

  const input = h('input', {
    id: 'addr',
    class: 'input mono',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder: 'u1…',
    'aria-describedby': 'addr-msg',
  });
  const msg = h('p', { id: 'addr-msg', class: 'msg', role: 'status' });
  const setMsg = (text: string, tone: 'bad' | 'ok' | '' = '') => {
    msg.textContent = text;
    msg.className = `msg ${tone ? `msg-${tone}` : ''}`;
    input.setAttribute('aria-invalid', String(tone === 'bad'));
  };

  input.addEventListener('input', () => {
    if (looksLikeSeed(input.value)) {
      input.value = '';
      setMsg("Whoa. That looks like a recovery phrase. Never paste your words anywhere, including here. We cleared it.", 'bad');
    } else if (msg.textContent) setMsg('');
  });

  const paste = navigator.clipboard?.readText
    ? h(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onclick: async () => {
            try {
              input.value = (await navigator.clipboard.readText()).trim();
              input.dispatchEvent(new Event('input'));
            } catch {
              setMsg('Paste blocked. Long-press the field and choose Paste.');
            }
          },
        },
        'Paste',
      )
    : null;

  const accept = async (address: string, short: string, kind: typeof state.kind, note?: string) => {
    state.address = address;
    state.short = short;
    state.kind = kind;
    input.value = '';
    form.querySelectorAll('button, input').forEach((e) => ((e as HTMLButtonElement).disabled = true));
    const tl = world.turnKey();
    tl.call(() => sound.play('clunk'), [], 'clunk');
    await tl;
    if (!live()) return;
    ctx.complete(1);
    watcher.say(
      kind === 'sapling'
        ? "A zs address? Still shielded. Doesn't tell me much. Annoying."
        : "Your u1 address? Doesn't tell me much. No balance, no history. Annoying.",
    );
    fillPanel(panel, [
      eyebrow('Chapter 1 · Forge your key'),
      title('The gate knows you now.'),
      h('p', { class: 'addr-chip mono' }, h('span', { class: 'addr-dot', 'aria-hidden': 'true' }), short, kind === 'demo' ? h('em', {}, ' demo') : null),
      note ? para(note, 'small') : null,
      para('It opens for what you bring through it. First you need something worth hiding.'),
      row(btn('Continue', () => ctx.goTo('plant'))),
    ]);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const r = checkAddress(input.value);
    if (!r.ok) {
      setMsg(r.message, 'bad');
      if (!reduced) gsap.fromTo(input, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.5, 0.3)' });
      return;
    }
    setMsg('Valid address. Turning the key…', 'ok');
    accept(r.address, shortAddr(r.address), r.kind, r.note);
  };

  const form = h(
    'form',
    { class: 'addr-form', onsubmit: submit, novalidate: true },
    h('label', { class: 'field-label', for: 'addr' }, 'Your Zcash address'),
    h('div', { class: 'input-row' }, input, paste),
    msg,
    row(h('button', { class: 'btn btn-primary', type: 'submit' }, 'Turn the key')),
    h(
      'button',
      {
        class: 'btn btn-link',
        type: 'button',
        onclick: () => {
          ctx.setDemo(true);
          accept(DEMO.address, DEMO.short, 'demo');
        },
      },
      "I don't have one yet, use a demo key",
    ),
  );

  fillPanel(panel, [
    eyebrow('Chapter 1 · Forge your key'),
    title('Give the gate your address'),
    para('In Zodl, tap Receive and copy your Zcash address. It starts with u1.'),
    form,
    para('It stays in this tab. Nothing is sent anywhere.', 'small muted'),
  ]);
};

// ---------------------------------------------------------------- Scene 2
const plant: Enter = (ctx, live) => {
  const { world, watcher, panel, sound } = ctx;
  world.show('outside', 0.3);
  world.setLocked(false);
  world.doors(false, 0);
  world.setStall(false);
  world.insideSapling(false);
  state.planted = false;
  world.hideField();
  watcher.clear('chapter 2 · plant');
  watcher.say('Nothing on you yet. Go on, get some ZEC.');
  requestAnimationFrame(() => world.frame(world.BOX.field));

  const slider = () => amountSlider((a) => state.planted && world.setFieldSize(a, fmt(a)));
  const moreCommon = para("Most people arrive through an exchange though, so let's see what that looks like.");

  const exchange = async () => {
    world.insideSapling(false);
    state.planted = true;
    world.plantField(state.amount, fmt(state.amount));
    watcher.clear('chapter 2 · plant');
    watcher.field('address', state.tAddr, 'addr');
    watcher.field('received', fmt(state.amount), 'amt');
    watcher.field('from', 'exchange withdrawal', 'src');
    watcher.say(`Got you. Transparent address ${state.tAddr.slice(0, 2)}… received ${fmt(state.amount)} from an exchange withdrawal. I can see your balance and where it came from.`);
    ctx.complete(2);
    fillPanel(panel, [
      eyebrow('Chapter 2 · Plant your tree'),
      title('Planted in the open'),
      para("Exchanges usually send to your transparent address. It's public, like Bitcoin."),
      slider(),
      realCard(
        [
          'Easiest: in Zodl, tap Swap to turn USDC, BTC or SOL into ZEC. It lands shielded.',
          'From an exchange: open Receive in Zodl and copy your transparent address. Some exchanges like Gemini accept your shielded one.',
        ],
        [
          { label: 'Swapping into ZEC', href: ZODL_SWAP_GUIDE },
          { label: 'Depositing from exchanges', href: ZODL_EXCHANGE_GUIDE },
        ],
      ),
      row(btn('Hide it', () => live() && ctx.goTo('shield'))),
    ]);
  };

  const landedInside = (heading: string, lines: string[]) => {
    sound.play('pop');
    world.insideSapling(true);
    watcher.say("Something landed somewhere. That's all I've got.");
    fillPanel(panel, [
      eyebrow('Chapter 2 · Plant your tree'),
      title(heading),
      ...lines.map((l) => para(l)),
      moreCommon,
      row(btn('Show me the exchange way', exchange)),
    ]);
  };

  const card = (name: string, sub: string, tag: string, onclick: () => void) =>
    h('button', { class: 'path-card', type: 'button', onclick }, h('span', { class: 'path-tag' }, tag), h('strong', {}, name), h('span', {}, sub));

  fillPanel(panel, [
    eyebrow('Chapter 2 · Plant your tree'),
    title('Plant your tree'),
    para('Every tree starts as ZEC. How are you getting yours?'),
    slider(),
    h(
      'div',
      { class: 'paths' },
      card('Buy on an exchange', 'Withdraw ZEC to your wallet.', 'Most common', exchange),
      card('Swap in Zodl', 'Turn USDC, BTC or SOL into ZEC.', 'Lands shielded', () =>
        landedInside('Landed inside', ['Swaps in Zodl land straight in the orchard, already shielded. Nothing for the Watcher to see.']),
      ),
      card('A friend sends it', 'Share your address, get ZEC.', 'Depends', () =>
        landedInside('From a friend', [
          'If your friend sends from a shielded address, it lands inside the wall, private from the start.',
          'If they send from a transparent address, it lands out here in the open field.',
        ]),
      ),
    ),
  ]);
};

// ---------------------------------------------------------------- Scene 3
const NO_IDEA = ['No idea.', 'Could be that one. Could be any of them.', 'They all look the same.', 'Nope. Nothing.', 'No idea. Again.', 'Every one of these is identical.'];

const shield: Enter = (ctx, live) => {
  const { world, watcher, panel, sound } = ctx;
  let untap: (() => void) | null = null;
  world.show('outside', 0.3);
  world.setLocked(false);
  world.doors(false, 0);
  world.setStall(false);
  world.insideSapling(false);
  world.setUserPlanted(false);
  world.showField(state.amount, fmt(state.amount));
  requestAnimationFrame(() => world.frame(world.BOX.field));
  watcher.clear('chapter 3 · shield');
  watcher.field('address', state.tAddr, 'addr');
  watcher.field('balance', fmt(state.amount), 'bal');
  watcher.field('from', 'exchange withdrawal', 'src');
  watcher.say("Still watching that tree. Address, balance, history. All of it.");

  const challenge = () => {
    let taps = 0;
    const reply = h('p', { class: 'watch-reply', 'aria-live': 'polite' });
    const keyBtn = btn('Use your key', () => {
      sound.play('chime');
      untap?.();
      fillPanel(panel, [
        eyebrow('Chapter 3 · Hide your tree'),
        title('There it is.'),
        para('Only your key can find it. Every shielded coin looks the same, and the more people use the shielded pool, the bigger the orchard you hide in.'),
        realCard(['When Zodl shows a transparent balance, tap Shield.', 'Zodl makes you shield before spending, so your spending stays private.']),
        row(btn('Next: unshielding', () => ctx.goTo('unshield'))),
      ]);
      requestAnimationFrame(() => world.focusUser().then(() => world.glowUser()));
    });
    keyBtn.hidden = true;
    untap = world.onTreeTap(() => {
      taps++;
      const line = NO_IDEA[(taps - 1) % NO_IDEA.length];
      reply.textContent = `Watcher: “${line}”`;
      watcher.say(line);
      if (taps >= 2 && keyBtn.hidden) {
        keyBtn.hidden = false;
        if (!reduced) gsap.fromTo(keyBtn, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4 });
      }
    });
    fillPanel(panel, [
      eyebrow('Chapter 3 · Hide your tree'),
      title('Watcher, which tree is theirs?'),
      para('You play the Watcher now. Tap any tree.'),
      reply,
      row(keyBtn),
    ]);
  };

  const go = async () => {
    sound.play('creak');
    sound.hush(4.5);
    fillPanel(panel, [eyebrow('Chapter 3 · Hide your tree'), title('Through the gate…')]);
    watcher.say('Wait. Where is it going?');
    await world.shield();
    if (!live()) return;
    watcher.redact(['addr', 'bal', 'src']);
    watcher.field('sender', NOISE, 's');
    watcher.field('receiver', NOISE, 'r');
    watcher.field('amount', NOISE, 'a');
    watcher.redact(['s', 'r', 'a']);
    watcher.say("It went in. Now it's one of a hundred identical trees.");
    challenge();
  };

  fillPanel(panel, [
    eyebrow('Chapter 3 · Hide your tree'),
    title('Hide your tree'),
    para('How do you hide a tree? Put it in an orchard full of trees that look exactly like it.'),
    h('div', { class: 'hold-wrap' }, holdButton('Hold to Shield', go, 1500, () => sound.play('tick')), para('Press and hold', 'small muted')),
  ]);
  return () => untap?.();
};

const unshield: Enter = (ctx, live) => {
  const { world, watcher, panel } = ctx;
  world.show('inside', 0.4);
  world.setUserPlanted(true);
  world.setGolden(false);
  world.gardener(false);
  world.setStall(false);
  world.hideField();
  requestAnimationFrame(() => world.frame(world.BOX.orchard, { dur: 0.9 }));
  watcher.clear('chapter 3 · unshield');
  watcher.say("Inside the wall? I've got nothing. I'll wait by the gate.");
  const out = Math.max(0.01, Math.round(state.amount * 0.4 * 100) / 100);

  const go = async () => {
    carry.disabled = true;
    await world.unshieldFruit(fmt(out));
    if (!live()) return;
    watcher.field('to', `exchange ${state.exAddr}`);
    watcher.field('amount', fmt(out));
    watcher.field('from', NOISE, 'from');
    watcher.redact(['from']);
    watcher.say(`Exchange address ${state.exAddr.slice(0, 2)}… received ${fmt(out)}. I can't see where it came from inside, but I can see where it went and how much.`);
    ctx.complete(3);
    fillPanel(panel, [
      eyebrow('Chapter 3 · Unshield'),
      title('Out in the open again'),
      h(
        'p',
        { class: 'tip' },
        h('strong', {}, 'Tip. '),
        'Only unshield what you need. Unusual amounts sent in and out at similar times can be linked, so avoid sending the exact amount you just shielded straight back out.',
      ),
      realCard(["In Zodl, paste the exchange's deposit address and send only what you need.", 'That leg is public: where it went and how much show on chain.']),
      row(btn('Next: pass it on', () => ctx.goTo('send'))),
    ]);
  };

  const carry = btn('Carry a fruit to the exchange', go);
  fillPanel(panel, [
    eyebrow('Chapter 3 · Unshield'),
    title('Unshielding'),
    para("Sometimes you need to send ZEC back out, like selling on an exchange. That's unshielding."),
    row(carry),
  ]);
};

// ---------------------------------------------------------------- Scene 4
const send: Enter = (ctx, live) => {
  const { world, watcher, panel } = ctx;
  world.show('inside', 0.4);
  world.setUserPlanted(true);
  world.setGolden(false);
  world.setStall(false);
  world.gardener(true);
  requestAnimationFrame(() => world.frame(world.BOX.orchard, { dur: 0.9 }));
  watcher.clear('chapter 4 · send');
  watcher.say("Inside again. I'm squinting at the gate.");

  const memo = h('textarea', { id: 'memo', class: 'input memo', rows: 2, placeholder: 'Write a private note…', maxlength: 512 });
  const count = h('span', { class: 'count mono' }, '0 / 512 bytes');
  memo.value = state.memo;
  const update = () => {
    let v = memo.value;
    while (bytes(v) > 512) v = Array.from(v).slice(0, -1).join('');
    if (v !== memo.value) memo.value = v;
    const n = bytes(v);
    count.textContent = `${n} / 512 bytes`;
    count.classList.toggle('is-near', n > 460);
  };
  memo.addEventListener('input', update);
  update();

  const amounts = [0.01, 0.05, 0.1];
  const seg = h(
    'div',
    { class: 'seg', role: 'radiogroup', 'aria-label': 'Amount' },
    ...amounts.map((a) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(a === state.sendAmount), class: 'seg-btn' }, fmt(a));
      b.addEventListener('click', () => {
        state.sendAmount = a;
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      });
      return b;
    }),
  );

  const go = async () => {
    state.memo = memo.value;
    const R = 40;
    const C = 2 * Math.PI * R;
    const ring = h('div', {
      class: 'confirm',
      html: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="hold-track"/><circle cx="50" cy="50" r="${R}" class="hold-fill" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><span>Confirming…</span>`,
    });
    fillPanel(panel, [
      eyebrow('Chapter 4 · Pass it on'),
      title('Sending'),
      ring,
      para('This is sped up. A real Zcash block takes about 75 seconds.', 'small muted'),
    ]);
    watcher.say('A transaction happened.');
    watcher.field('from', NOISE, 'f');
    watcher.field('to', NOISE, 't');
    watcher.field('amount', NOISE, 'a');
    watcher.field('memo', NOISE, 'm');
    watcher.redact(['f', 't', 'a', 'm']);
    watcher.say('Who sent it, who got it, how much, what the note says? ???');
    const fill = ring.querySelector<SVGCircleElement>('.hold-fill')!;
    await Promise.all([
      world.passFruit('send'),
      gsap.to(fill, { strokeDashoffset: 0, duration: reduced ? 0.6 : 3.6, ease: 'power1.inOut' }).then(() => undefined),
    ]);
    if (!live()) return;
    ring.querySelector('span')!.textContent = 'Confirmed';
    ring.classList.add('is-done');
    appendPanel(panel, [
      para('The fruit crossed the orchard and nobody outside saw a thing.'),
      row(btn('Next: receive', () => ctx.goTo('receive'))),
    ]);
  };

  fillPanel(panel, [
    eyebrow('Chapter 4 · Pass it on'),
    bubble('Bramble the hedgehog', 'Spare a peach? Or an eggplant. I am not picky.'),
    h('label', { class: 'field-label', for: 'memo' }, 'Private memo'),
    memo,
    h('div', { class: 'memo-meta' }, count, h('span', { class: 'small muted' }, 'Encrypted. Only Bramble can read it.')),
    seg,
    row(btn('Send', go)),
  ]);
};

const receive: Enter = (ctx, live) => {
  const { world, watcher, panel } = ctx;
  world.show('inside', 0.4);
  world.setUserPlanted(true);
  world.setGolden(false);
  world.gardener(true);
  requestAnimationFrame(() => world.frame(world.BOX.orchard, { dur: 0.9 }));
  watcher.clear('chapter 4 · receive');
  watcher.say('Your address? Never saw it. It never left this page.');

  const demo = state.kind === 'demo';
  const copy = demo
    ? null
    : h(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onclick: async (e: Event) => {
            const b = e.currentTarget as HTMLButtonElement;
            try {
              await navigator.clipboard.writeText(state.address);
              b.textContent = 'Copied';
            } catch {
              b.textContent = 'Copy failed';
            }
            setTimeout(() => (b.textContent = 'Copy'), 1600);
          },
        },
        'Copy',
      );

  const ask = async () => {
    askBtn.disabled = true;
    await world.passFruit('receive');
    if (!live()) return;
    watcher.say('Something moved again. ???');
    const n = bytes(state.memo);
    const reply = n
      ? `Welcome to the orchard. Got your ${n}-byte note. Nobody else did.`
      : 'Welcome to the orchard. No note? A fruit speaks for itself.';
    ctx.complete(4);
    appendPanel(panel, [
      h('div', { class: 'note' }, h('span', { class: 'note-from' }, 'Memo from Bramble'), h('p', {}, reply)),
      realCard(["Send a tiny amount, like 0.001 ZEC, to a friend's u1 address with a memo.", 'Then ask them to send one back.']),
      row(btn('Step inside', () => ctx.goTo('inside'))),
    ]);
  };
  const askBtn = btn('Ask Bramble to send one back', ask);

  fillPanel(panel, [
    eyebrow('Chapter 4 · Pass it on'),
    title('Receive'),
    para('This is how people pay you. Share your u1 address or this QR.'),
    h(
      'div',
      { class: `qr-block${demo ? ' is-demo' : ''}` },
      h('div', { class: 'qr-wrap', html: qrSvg(demo ? 'Demo key. Not a real address.' : state.address) }, demo ? h('span', { class: 'qr-stamp' }, 'Demo') : null),
      h(
        'div',
        { class: 'qr-side' },
        h('p', { class: 'addr-chip mono' }, h('span', { class: 'addr-dot', 'aria-hidden': 'true' }), state.short || DEMO.short),
        copy,
        demo ? para('In Zodl, your real one lives on the Receive screen.', 'small muted') : null,
      ),
    ),
    row(askBtn),
  ]);
};

// ---------------------------------------------------------------- Scene 5
const inside: Enter = (ctx) => {
  const { world, watcher, panel } = ctx;
  world.show('inside', 0.4);
  world.setUserPlanted(true);
  world.gardener(false);
  world.setStall(false);
  watcher.clear('the orchard');
  watcher.say("I've got nothing on you. Well played.");
  ctx.complete(5);

  const share = `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`;
  fillPanel(panel, [
    eyebrow('Chapter 5 · Inside'),
    h('h2', { class: 'panel-title panel-title-big' }, 'You entered the Orchard.'),
    h(
      'ul',
      { class: 'recap' },
      h('li', {}, h('strong', {}, 'Key. '), 'You set up Zodl and kept your 24 words to yourself.'),
      h('li', {}, h('strong', {}, 'Tree. '), 'You got ZEC, and saw exchange deposits land in the open.'),
      h('li', {}, h('strong', {}, 'Orchard. '), 'You shielded it, and unshielded only what you needed.'),
      h('li', {}, h('strong', {}, 'Fruit. '), 'You sent and received privately, memo and all.'),
    ),
    row(
      linkBtn('Share on X', share, 'primary'),
      btn('Do it for real', () => ctx.openGuide(), 'ghost'),
    ),
    row(
      btn('Save a share card', () => saveShareCard(), 'link'),
      btn('Play again', () => location.reload(), 'link'),
    ),
  ]);
  requestAnimationFrame(() => world.golden());
};

export const steps: Record<StepId, Enter> = { gate, wallet, stranger, key, plant, shield, unshield, send, receive, inside };
