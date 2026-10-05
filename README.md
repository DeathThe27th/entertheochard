# Enter the Orchard

**Zero to your first private Zcash transaction.**

An interactive, game-like onboarding site for Zcash. It walks a complete beginner through wallet setup, getting ZEC, shielding and unshielding, and sending and receiving, all inside one metaphor:

- **The open field** is the transparent chain. Anything out here is visible.
- **The Orchard** is Zcash's shielded pool. Everything inside looks identical.
- **The gate** is the shielding moment.
- **Your ZEC is a tree.** You hide it by planting it among hundreds of identical trees.
- **The Watcher** is a stranger reading the blockchain. A live pane shows what they can (and can't) see at every step.

Live: **https://enter-the-orchard.vercel.app**

Built for the ZECATHON Wildcard onboarding bounty by [@zksnarks_](https://x.com/zksnarks_).

## Chapters

1. **Forge your key**: set up the Zodl wallet, back up your 24 words, and survive a seed-phishing stranger at the wall.
2. **Plant your tree**: get ZEC from an exchange or Zodl's built-in swap, and see exchange deposits land in the open.
3. **Hide your tree**: shield into the Orchard and watch the Watcher lose track of you, then unshield and see what becomes public again.
4. **Pass it on**: send a fully shielded transaction with an encrypted memo, and receive with your address or QR code.
5. **Inside**: recap, a share card, and a field guide for doing it for real.

## Safety by design

- No input fields for seed words, anywhere. The phishing scene uses buttons only.
- Never asks for, stores, or transmits keys or seed phrases.
- Your address stays in memory for the session only. It is never sent to a server, placed in a URL, or put on the share card.
- No backend, no database, no analytics, no cookies. Every real-money action happens in your own wallet.

## Stack

Vite + vanilla TypeScript, Three.js for the 3D world, GSAP for motion, and a Web Audio synth for sound. Mobile-first, and it respects `prefers-reduced-motion`.

## Run locally

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
```

## Project layout

```
app/
  index.html       page shell and meta tags
  public/          favicon, social card
  src/
    main.ts        entry point and scene flow
    scenes.ts      the chapters and their steps
    world3d.ts     Three.js orchard, field and gate
    world.ts       2D world layer and transitions
    watcher.ts     the Watcher pane
    address.ts     Zcash address validation (u1 / t1 / t3 / zs)
    qr.ts          QR code generator for receiving
    share.ts       share card
    sound.ts       procedural sound
    config.ts      external links and constants
```
