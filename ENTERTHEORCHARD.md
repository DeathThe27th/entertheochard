# Enter the Orchard

Build brief for entertheorchard.xyz, a scroll-driven 3D web experience that takes someone from zero to their first shielded Zcash transaction.

Submission for the ZECATHON Wildcard track by @zksnarks_. Prize is a $5,000 bounty paid in ZEC for the best onboarding video series or web experience. The brief covers wallet setup, getting ZEC, shielding and unshielding, and sending and receiving. Submission is a tweet tagging @zksnarks_. Deadline is Sunday, October 4, 2026.

---

## 0. The bar

Build this the way a senior creative developer and a motion designer would if a client were paying $25,000 for it. That means an award-site level of craft, the kind of work that wins Awwwards Site of the Day, in the tradition of studios like Active Theory, Lusion and Igloo Inc. Take the level of care as the reference, not their designs. Everything here is original.

In practice that bar means the following. Hold every scene to it before moving on.

Art direction
- Every frame could be a screenshot someone posts. If a frame looks like a tech demo or a template, it isn't done.
- Composition is deliberate: a clear focal point, depth from foreground to background, and negative space that lets headlines breathe.
- Colour is restrained. Cold glass world, warm gold underground, one red for the watcher. Nothing else competes.
- Lighting sells the mood more than geometry. Spend time on fog, rim light, bloom and depth of field.

Motion
- Nothing moves linearly. Use custom easing (expo and custom cubic-bezier curves) and give heavy things weight and light things float.
- Every transition is choreographed. Elements enter in a staggered order, and scenes hand off to each other through a shared object (the fruit, the shoot, a root) instead of cutting.
- Scroll drives the story, but it must never feel like scrubbing a video. Add inertia, easing on the scroll progress and small idle motion (swaying branches, drifting dust) so the world is alive even when the visitor stops.
- Headline text animates in by line or by word with masks, never a plain fade.
- The pacing breathes. Big moments get space, quiet moments are short. Act V should feel like the whole site was building to it.

Micro-interactions
- A custom cursor on desktop that reacts to what it's over, with magnetic buttons on the CTAs.
- Hover, press and focus states on everything interactive, with subtle sound ticks when sound is on.
- The practice phone feels like a real app: real transitions between screens, haptic-style press feedback, a believable status bar.
- The loader is a moment of its own, not a spinner.

Typography
- A proper type scale, tight headline tracking, and careful line breaks so no single word dangles on a line. Break headline lines by hand.
- Addresses and wallet numbers in mono, with the first and last characters visually distinct.

Engineering polish
- No layout shift, no flash of unstyled content, no janky first frame. The page is fully composed before the loader lets go.
- Smooth on a mid-range phone. Cutting detail for mobile is expected, but cutting the story or the big moments is not.
- Resize, rotate and tab-away all handled cleanly. The animation loop pauses when the tab is hidden.
- Clean, organised code: one module per act, shared utilities for easing, text splitting and scroll mapping, and no dead code at the end.

QA before calling any act done
- Watch it at full speed on desktop and on a real phone, start to finish.
- Scroll fast, scroll backwards, and jump from the chapter index. Nothing breaks, sticks or pops.
- Check it with reduced motion on and with WebGL off.
- Read every line of copy on screen at mobile size.
- Ask honestly whether a senior motion designer would sign their name to it. If not, keep going.

## 1. The idea in one breath

On a public blockchain your money hangs in the open, like fruit on glass trees under floodlights. Anyone can read it. Zcash lets you plant it underground, where it joins a vast root network that nobody can trace but everyone can trust. That underground network is the Orchard, the name of Zcash's current shielded pool.

The visitor is the main character. The villain is a red scanner beam that watches everything. The story is you disappearing from it, one step at a time, until the scanner sweeps the whole orchard, finds nothing, and switches off.

A floating phone runs a practice wallet alongside the story. The visitor does every step for pretend, and each act ends with a real button to do it for real.

## 2. Rules for the whole experience

1. Never teach with a wall of text. One idea per screen, lines of about ten words or fewer.
2. Show, then say. The motion carries the lesson and the copy just names it.
3. No jargon in the main flow. Words the visitor needs because their wallet uses them are allowed: wallet, recovery phrase, shielded, transparent, shield, unshield, address, memo. Everything else (zk-SNARKs, Halo 2, note commitments, pools, ZIPs) lives only in the optional Field Guide drawer, if anywhere.
4. Every act ends with one clear real-world CTA. Nothing more.
5. Tips appear at the moment they matter, never as a list.
6. The practice wallet is clearly labeled Practice. It uses fake words and fake addresses. The site must never ask anyone to type or paste a real recovery phrase or key. Say so on screen once, early.
7. All copy is real DOM text layered over the canvas, so it is readable, selectable and accessible even if WebGL fails.
8. Silence is a tool. The biggest moment (shielding) goes quiet.

## 3. Visual and sound language

Above ground is cold. Glass trees, white and pale cyan, harsh floodlights, hard shadows, a red scanner beam with a faint CRT scanline texture. It should feel exposed and slightly uncomfortable.

Below ground is warm and alive. Dark soil, deep indigo to black, roots glowing in Zcash gold (#F4B728) with soft bloom. Shielded ZEC is dark, opaque fruit with a gold core. Transparent ZEC is glass fruit.

The zkSNARKs brand uses purple CRT screens and pixel masks. Nod to it with the scanner's scanline texture and a faint purple tint in the watcher's UI, but keep the orchard itself its own world.

Type: a sharp grotesk for headlines and a clean mono for addresses and wallet UI. Headlines large, quiet, with plenty of space.

Sound (off by default, toggle in the corner): floodlight hum and faint glass chimes above ground, a low warm drone underground, soft plucks as roots light up. Everything cuts to silence at the shielding moment, then the drone swells back.

## 4. The story, act by act

Each act lists what happens on screen, the exact copy, what the visitor does, and the CTA.

### Prologue. The Seed (loader)

Black screen. A single seed pulses in the center with a counter ticking to 100 while assets load. At 100 the seed cracks and a thin shoot punches upward, and the camera rides it up and out into Act I. No text except the counter.

### Act I. The Glass Field

A vast glass orchard under floodlights. Every fruit is someone's wallet. Thin labels drift out of the fruit showing balances, payments and timestamps. The red scanner sweeps across the field and tags fruit as it passes. The camera settles on one fruit, which turns toward the visitor and lights up with their label.

Copy, one line at a time as they scroll:

> On most blockchains, your money hangs in the open.
> Your balance. Who pays you. What you buy.
> Anyone can read it. Forever.
> This one's yours.

The scanner locks onto the visitor's fruit. The screen glitches red. The ground cracks open and the fruit drops.

### Act II. The Fall

The camera falls with the fruit through layers of soil. As it falls, the fruit's labels peel away one by one (amount, sender, receiver) and burn out. It lands softly in the dark, still glowing, still whole.

> Zcash is money that can hide every detail
> and still prove it's real.
> No sender. No receiver. No amount.
> Just proof that nothing's fake.

Small moment: a locked box glows in the dark with a button labeled Prove it. Tapping it makes the box glow green without opening.

> The network checks the proof. Not your business.

Transition: the fruit splits and a seedling rises. The practice phone fades in beside it.

> Let's grow yours.
> (Practice mode. Nothing here is real, and we'll never ask for your real recovery phrase.)

### Act III. Your Tree (wallet setup)

The practice phone boots a clean wallet screen with a single button, Create wallet. Tapping it grows a young tree in the soil.

The recovery phrase appears as 24 fake words, each a leaf on the tree (confirm Zodl's current word count and match it). The leaves shiver, three of them blow away, and the visitor taps them back into their slots in order. This should feel gentle, with generous hit areas and a skip link.

> These words are your wallet.
> Lose them and it's gone. Share them and it's someone else's.
> Write them on paper. Not a screenshot. Not a chat.
> No real support team will ever ask for them.

A quiet aside slides in and out:

> MetaMask and Phantom can't hold ZEC. Zcash lives on its own chain.

CTA: Get Zodl, with App Store, Google Play and F-Droid buttons. A small "Other wallets" link opens the Field Guide.

### Act IV. The Harvest (getting ZEC)

Three branches grow from the tree, each a way to get ZEC, and the visitor taps each branch to watch it deliver.

The swap branch: streams of other coins (generic BTC and stablecoin glyphs, not brand logos) flow up the branch and ripen into dark shielded fruit.

> Already have crypto? Swap it for ZEC right inside Zodl.

The exchange branch: fruit arrives as glass, and the scanner beam immediately flicks toward it from above.

> Bought ZEC on an exchange? It usually arrives transparent.
> Visible, for now.

The friend branch: the phone shows the visitor's practice address starting with u1, and a dark fruit drops in.

> Or ask a friend. Give them the address that starts with u.

This act is where the visitor learns the two kinds of address without a lecture. Dark means shielded and private. Glass means transparent and public.

CTA: Get ZEC in Zodl, plus a smaller "Where else can I buy?" link to the Field Guide.

### Act V. The Planting (shielding)

This is the showpiece. Spend the most craft here.

The practice phone shows a yellow banner: Transparent balance detected. The scanner beam is still hovering above the glass fruit. The visitor taps Shield.

All sound cuts. The glass fruit detaches and falls in slow motion, hits the soil and shatters into thousands of gold particles. The camera dives after them. They pour into the roots, and the roots ignite outward from that point in every direction, revealing that the root network is enormous. It runs under every tree in the orchard, far into the dark. The drone swells back in.

> This is the Orchard.
> Down here, your ZEC looks like everyone else's.
> That's the point.
> The more people plant here, the harder anyone is to find.

Above, faintly, the scanner beam passes over the spot where the fruit was and finds nothing.

CTA: Shield your ZEC. Zodl does it in one tap. The progress ring marks this step.

### Act VI. The Whisper (sending and receiving)

A second tree glows across the orchard, labeled Friend. The practice phone shows a Send screen with the friend's u1 address filled in and a memo field. The visitor types a short message or picks a suggested one ("coffee's on me").

Before Send unlocks, the first and last four characters of the address pulse.

> Always check the start and end of an address before you send.

The visitor taps Send. A pulse of gold light carries through the roots from their tree to the friend's, with the memo riding inside it as a small sealed glyph. Up top, the scanner sweeps the surface and sees only still, dark ground.

> Private to private. Nobody sees who, what, or how much.
> Your note travels encrypted. Only your friend can read it.
> It lands in about a minute.

Then it flips around. The phone shows a Receive screen with a QR code, and a pulse arrives at the visitor's tree.

> To get paid, just share your QR code.

CTA: Send your first private payment.

### Act VII. The Surfacing (unshielding)

A dark fruit pushes up through the soil and turns to glass as it hits the light. The scanner beam swings toward it instantly.

> Sometimes you need to come back up.
> Selling on an exchange. Paying someone without a shielded address.
> That trip is public. Only bring up what you need.

The tip lands at the moment it matters. Two fruits of identical size, one sinking and one rising right after, get connected by a red thread drawn by the scanner.

> Don't shield and unshield the same amount back to back.
> Matching amounts can link you. Give it time and vary it.

One more small card:

> Paying someone who wants Bitcoin or dollars? Zodl can send it straight from your shielded ZEC. They never need to touch Zcash.

CTA: none of its own. Link to the Field Guide section on exchanges.

### Act VIII. Nightfall

The floodlights above flicker. The scanner makes one last slow sweep across the entire orchard, left to right, and finds nothing anywhere. It stutters, and the floodlights die one by one. In the dark, the orchard comes alive. Every tree glows faintly gold from below, and fireflies drift between them. Each firefly is a shielded transaction.

The camera pulls up and back to show the visitor's tree, now full-grown, among thousands.

> You just did it in practice.
> Wallet. ZEC. Shielded. Sent. Received.
> Now do it for real.

The progress ring completes, then resets into a real-world checklist the visitor can tick as they go:

1. Download Zodl
2. Write down your recovery phrase
3. Get some ZEC
4. Shield it
5. Send your first private payment

Final CTA, big and centered: Enter the Orchard, which opens the Zodl download.

Secondary: Share, which opens a prefilled post on X, for example "I just learned how to make my first shielded Zcash transaction in about four minutes. Enter the Orchard: entertheorchard.xyz".

## 5. The Field Guide drawer

A pull-up drawer, reachable from a small leaf icon in the corner at any time. This is where all the depth lives, so the main story stays clean. Keep each section to a few sentences.

- Other wallets. Zingo and YWallet for mobile and desktop, Brave Wallet for shielded ZEC on desktop, and Keystone for shielded cold storage paired with Zodl. Ledger has a Zcash Shielded app on Nano S Plus, Stax and Flex that needs a companion wallet, which is not beginner territory yet.
- Where to buy. A short list of exchanges that currently list ZEC, verified at build time. Remind people that exchange withdrawals usually arrive transparent, so shield them after.
- Sending to exchanges. Some exchanges only accept deposits from transparent addresses. Check their rules before sending.
- Viewing keys. You can let an accountant or auditor see your history without giving them any power to spend.
- Fees. Tiny, a fraction of a cent at today's prices. Verify the current number before stating it.
- Paying in stores. Zodl works with Flexa for paying at some retailers. Verify the current merchant list before naming any.
- For the curious. One paragraph on zero-knowledge proofs and a link to z.cash for more.

## 6. Always on screen

- A progress ring showing how much of the visitor's orchard has grown, with a tap to open a chapter index.
- A sound toggle, off by default.
- The Field Guide leaf.
- A "Skip to the real steps" link that jumps to Act VIII's checklist for people who already know the basics.

## 7. Links (verify every one at build time)

- Zodl home: https://zodl.com
- Zodl on the App Store: https://apps.apple.com/us/app/zashi-zcash-wallet/id1672392439 (listing may still be named Zashi)
- Zodl on Google Play: https://play.google.com/store/apps/details?id=co.electriccoin.zcash
- Zodl on F-Droid: https://f-droid.org/en/packages/co.electriccoin.zcash.foss/
- Zodl support: https://support.zodl.com
- Zcash: https://z.cash
- Zingo, YWallet, Brave Wallet, Keystone: find and confirm the official URLs, do not guess.

## 8. Facts to verify before shipping

The practice wallet should mirror Zodl's real flow, so check these against the current app and docs:

- Recovery phrase word count in Zodl.
- The exact label and flow for shielding a transparent balance.
- That in-app swaps (powered by NEAR Intents) and CrossPay are live and what they're called in the app.
- Current exchanges listing ZEC.
- Current typical fee.
- Block time is about 75 seconds, so "about a minute" is fine in copy.

## 9. Tech plan

Stack: Vite + TypeScript, Three.js, GSAP with ScrollTrigger, Lenis for smooth scroll, and pmndrs postprocessing for bloom. No framework needed unless it speeds you up.

Scene approach:

- One persistent WebGL canvas behind a scroll-driven DOM layer. Each act is a pinned scroll section whose progress drives the camera and scene state on a single master timeline.
- Trees are procedural (branching or L-system geometry), not heavy GLTF files. Instance the orchard.
- Glass uses a fresnel and refraction shader. Only use MeshPhysicalMaterial transmission on the high quality tier because it's expensive.
- Roots are line or tube geometry with a shader that animates a growth front and gold glow along the path.
- The fruit shatter and root ignition use GPU particles.
- The scanner is a projected cone or volumetric plane with a scanline shader.
- The practice phone is a DOM element (real HTML UI) positioned in front of the canvas with 3D transforms, so its buttons are real and accessible.

Performance:

- Quality tiers chosen at load using GPU detection (detect-gpu or a quick benchmark). High tier gets full bloom, transmission and dense particles. Mobile tier gets fewer trees, cheaper glass, lower particle counts and half-resolution bloom.
- Targets are 60fps on a recent laptop and a steady 30fps or better on a mid-range Android phone.
- Keep shipped JS under about 600 KB gzipped. Lazy-load audio.
- Judges will open the link from X on their phones. Test on a real phone early and often.

Fallbacks and accessibility:

- If WebGL is unavailable, or the visitor has prefers-reduced-motion set, show a 2D illustrated version with the same copy, the same practice wallet and the same CTAs.
- CTAs are real links and all interactive elements are keyboard reachable.

Sharing:

- Proper Open Graph and Twitter card meta with a striking 1200x630 image of the night orchard, so the submission tweet looks great.
- Record a 30 to 45 second screen capture of the best moments (the fall, the planting, nightfall) to attach to the submission tweet. Many judges will watch that before clicking.

Deploy: GitHub repo connected to Vercel, custom domain entertheorchard.xyz.

## 10. Build order

The deadline is October 4, so always have a shippable version.

1. Skeleton. Scroll sections, all copy, the practice wallet UI and all CTAs working over a simple placeholder scene. Deploy it. This alone is a valid submission.
2. The two hero moments first: Act I (Glass Field) and Act V (Planting).
3. The Fall, Nightfall, then the remaining acts.
4. Mobile tier, fallbacks and real-device testing.
5. Sound, Field Guide, OG image, final fact check and link check.
6. Record the video and post the submission.
