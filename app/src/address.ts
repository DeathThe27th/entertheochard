/**
 * Client-side Zcash address checks. Nothing here touches the network.
 * Unified addresses (ZIP-316) are bech32m with HRP "u" and no length cap.
 * Sapling addresses are classic bech32 with HRP "zs".
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32 = 1;
const BECH32M = 0x2bc830a3;

function polymod(values: number[]) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string) {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function checksumOk(addr: string, hrp: string, constant: number) {
  const sep = addr.lastIndexOf('1');
  if (addr.slice(0, sep) !== hrp) return false;
  const data: number[] = [];
  for (const c of addr.slice(sep + 1)) {
    const v = CHARSET.indexOf(c);
    if (v < 0) return false;
    data.push(v);
  }
  if (data.length < 7) return false;
  return polymod(hrpExpand(hrp).concat(data)) === constant;
}

export type AddressResult =
  | { ok: true; kind: 'unified' | 'sapling'; address: string; note?: string }
  | { ok: false; message: string };

const NOT_ZCASH = "That doesn't look like a Zcash address.";

export function checkAddress(raw: string): AddressResult {
  let a = raw.trim().replace(/\s+/g, '');
  if (!a) return { ok: false, message: 'Paste your address first.' };
  // Transparent addresses are base58, so they are checked before any case rules.
  if (a.startsWith('tm')) {
    return { ok: false, message: "That's a testnet address. The gate wants a real mainnet one." };
  }
  if (a.startsWith('t1') || a.startsWith('t3')) {
    return {
      ok: false,
      message:
        "That's your transparent address, the public one. The gate wants your shielded address. In Zodl, it's the main one on the Receive screen.",
    };
  }
  // Bech32 allows all-uppercase (QR codes). Mixed case is never valid.
  if (a === a.toUpperCase() && /[A-Z]/.test(a)) a = a.toLowerCase();
  if (a !== a.toLowerCase()) return { ok: false, message: NOT_ZCASH };
  if (a.startsWith('utest') || a.startsWith('ztestsapling')) {
    return { ok: false, message: "That's a testnet address. The gate wants a real mainnet one." };
  }
  if (a.startsWith('u1')) {
    return checksumOk(a, 'u', BECH32M)
      ? { ok: true, kind: 'unified', address: a }
      : { ok: false, message: `${NOT_ZCASH} Check you copied all of it.` };
  }
  if (a.startsWith('zs')) {
    return checksumOk(a, 'zs', BECH32)
      ? {
          ok: true,
          kind: 'sapling',
          address: a,
          note: "That's a Sapling address. It works, but unified (u1) is the modern format.",
        }
      : { ok: false, message: `${NOT_ZCASH} Check you copied all of it.` };
  }
  return { ok: false, message: NOT_ZCASH };
}

/** Someone pasted words instead of an address. Never keep them. */
export function looksLikeSeed(raw: string) {
  const words = raw.trim().split(/\s+/);
  return words.length >= 6 && words.every((w) => /^[a-z]+$/i.test(w));
}

export function shortAddr(a: string) {
  return a.length <= 14 ? a : `${a.slice(0, 5)}…${a.slice(-4)}`;
}
