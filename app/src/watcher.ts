import { reduced } from './motion';

const GLYPHS = '#%&*+=?@$<>/\\|01';

/**
 * The Watcher: a terminal that shows what a stranger reading the chain sees.
 * Lines type in one after another. Values can be redacted to ??? later.
 */
export function createWatcher(root: HTMLElement, hooks: { type?: () => void; redact?: () => void } = {}) {
  const log = root.querySelector<HTMLElement>('#watcher-log')!;
  const bar = root.querySelector<HTMLButtonElement>('#watcher-bar')!;
  const peek = root.querySelector<HTMLElement>('#watcher-peek')!;
  let chain = Promise.resolve();
  let session = 0;

  bar.addEventListener('click', () => {
    const open = !root.classList.toggle('is-collapsed');
    bar.setAttribute('aria-expanded', String(open));
    root.classList.remove('has-new');
  });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function typeInto(el: HTMLElement, text: string, s: number) {
    if (reduced) {
      el.textContent = text;
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      if (s !== session) return;
      el.textContent = text.slice(0, i);
      log.scrollTop = log.scrollHeight;
      if (text[i - 1] !== ' ') hooks.type?.();
      await wait(text[i - 1] === ' ' ? 8 : 16);
    }
  }

  function enqueue(make: (s: number) => Promise<void>) {
    const s = session;
    chain = chain.then(() => (s === session ? make(s) : undefined));
    return chain;
  }

  function addLine(cls: string) {
    const line = document.createElement('p');
    line.className = `wl ${cls}`;
    log.append(line);
    log.scrollTop = log.scrollHeight;
    return line;
  }

  function notify(text: string) {
    peek.textContent = text;
    if (root.classList.contains('is-collapsed')) root.classList.add('has-new');
  }

  return {
    /** Wipe the log and cancel anything still typing. */
    clear(heading?: string) {
      session++;
      chain = Promise.resolve();
      log.replaceChildren();
      if (heading) {
        const h = addLine('wl-head');
        h.textContent = `// ${heading}`;
      }
    },
    say(text: string) {
      return enqueue(async (s) => {
        const line = addLine('wl-say');
        line.textContent = '> ';
        const span = document.createElement('span');
        line.append(span);
        notify(text);
        await typeInto(span, text, s);
        await wait(reduced ? 0 : 120);
      });
    },
    field(label: string, value: string, id?: string) {
      return enqueue(async (s) => {
        const line = addLine('wl-field');
        const k = document.createElement('span');
        k.className = 'wl-k';
        k.textContent = label.padEnd(9, ' ');
        const v = document.createElement('span');
        v.className = 'wl-v';
        if (id) v.dataset.id = id;
        line.append(k, v);
        await typeInto(v, value, s);
        await wait(reduced ? 0 : 60);
      });
    },
    /** Scramble values to ??? once everything before has finished typing. */
    redact(ids: string[]) {
      return enqueue(async () => {
        const els = ids
          .map((id) => log.querySelector<HTMLElement>(`[data-id="${id}"]`))
          .filter((e): e is HTMLElement => !!e);
        if (els.length) hooks.redact?.();
        await Promise.all(els.map((el, i) => scramble(el, i * 160)));
      });
    },
  };
}

function scramble(el: HTMLElement, delay: number) {
  return new Promise<void>((done) => {
    if (reduced) {
      el.textContent = '???';
      el.classList.add('is-redacted');
      return done();
    }
    const len = Math.max(3, el.textContent?.length ?? 3);
    let frame = 0;
    setTimeout(() => {
      el.classList.add('is-scrambling');
      const id = setInterval(() => {
        frame++;
        const keep = Math.max(3, Math.round(len * (1 - frame / 14)));
        let out = '';
        for (let i = 0; i < keep; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.textContent = out;
        if (frame >= 14) {
          clearInterval(id);
          el.textContent = '???';
          el.classList.remove('is-scrambling');
          el.classList.add('is-redacted');
          done();
        }
      }, 45);
    }, delay);
  });
}

export type Watcher = ReturnType<typeof createWatcher>;
