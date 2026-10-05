/**
 * Share card drawn on a canvas, entirely in the browser.
 * No address, no amounts. Just the orchard, the line and the date.
 */
export async function drawCard(w = 1200, hgt = 630) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const x = c.getContext('2d')!;
  try {
    await Promise.all([document.fonts.load('900 96px Fraunces'), document.fonts.load('500 28px Inter')]);
  } catch {
    /* fall back to system fonts */
  }

  const sky = x.createLinearGradient(0, 0, 0, hgt * 0.6);
  sky.addColorStop(0, '#9DB3B4');
  sky.addColorStop(0.6, '#EBC999');
  sky.addColorStop(1, '#F6E3BF');
  x.fillStyle = sky;
  x.fillRect(0, 0, w, hgt);

  const sun = x.createRadialGradient(930, 150, 0, 930, 150, 240);
  sun.addColorStop(0, 'rgba(255,246,221,1)');
  sun.addColorStop(0.3, 'rgba(251,224,166,.8)');
  sun.addColorStop(1, 'rgba(246,201,120,0)');
  x.fillStyle = sun;
  x.fillRect(0, 0, w, hgt);

  const tree = (cx: number, base: number, s: number) => {
    x.fillStyle = 'rgba(0,0,0,.16)';
    x.beginPath();
    x.ellipse(cx, base + 2 * s, 26 * s, 5 * s, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#5B3B24';
    x.fillRect(cx - 4 * s, base - 46 * s, 8 * s, 48 * s);
    const blob = (dx: number, dy: number, r: number, col: string) => {
      x.fillStyle = col;
      x.beginPath();
      x.arc(cx + dx * s, base + dy * s, r * s, 0, Math.PI * 2);
      x.fill();
    };
    blob(-15, -66, 22, '#2E5537');
    blob(16, -64, 21, '#2E5537');
    blob(0, -82, 27, '#3E6B45');
    blob(-12, -72, 20, '#3E6B45');
    blob(13, -74, 19, '#44754B');
    for (const [fx, fy] of [[-16, -62], [12, -84], [20, -62], [-2, -70]]) blob(fx, fy, 3.6, '#E3A33B');
  };

  // Rows of identical trees, back to front.
  for (let r = 0; r < 7; r++) {
    const t = r / 6;
    const s = 0.55 + 0.9 * t;
    const base = 300 + 330 * Math.pow(t, 1.2);
    const gap = 86 * s;
    for (let cx = ((r % 2) * gap) / 2 - gap; cx < w + gap; cx += gap) tree(cx, base, s);
  }

  // Shade the top so the title reads.
  const shade = x.createLinearGradient(0, 0, 0, hgt);
  shade.addColorStop(0, 'rgba(26,23,20,.55)');
  shade.addColorStop(0.55, 'rgba(26,23,20,.05)');
  shade.addColorStop(1, 'rgba(26,23,20,.25)');
  x.fillStyle = shade;
  x.fillRect(0, 0, w, hgt);

  x.fillStyle = '#F4EBDD';
  x.font = '600 26px Inter, system-ui, sans-serif';
  x.fillText('ZCASH · THE SHIELDED POOL', 72, 92);
  x.font = '900 100px Fraunces, Georgia, serif';
  x.shadowColor = 'rgba(0,0,0,.35)';
  x.shadowBlur = 24;
  x.fillText('I entered', 66, 200);
  x.fillText('the Orchard', 66, 300);
  x.shadowBlur = 0;
  x.font = '500 26px Inter, system-ui, sans-serif';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  x.fillText(`${date}  ·  enter-the-orchard.vercel.app`, 72, 352);
  return c;
}

export async function saveShareCard() {
  const c = await drawCard();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'i-entered-the-orchard.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      /* cancelled, fall through to download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
