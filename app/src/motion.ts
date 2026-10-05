export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duration helper: big moves collapse to near-instant under reduced motion. */
export const d = (seconds: number) => (reduced ? Math.min(seconds, 0.2) : seconds);

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced ? Math.min(ms, 150) : ms));
