// Pure JS HMAC-SHA256 (no external deps — works in Hermes)

function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  const padded = new Uint8Array(((len + 8) >> 6) * 64 + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, len * 8, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  for (let off = 0; off < padded.length; off += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++)
      w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }

  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
  return out;
}

function hmacSHA256(key: string, message: string): Uint8Array {
  const kb = encode(key);
  const mb = encode(message);
  let k: Uint8Array;
  if (kb.length > 64) k = sha256(kb);
  else { k = new Uint8Array(64); k.set(kb); }
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  const inner = new Uint8Array(64 + mb.length);
  inner.set(ipad); inner.set(mb, 64);
  const h = sha256(inner);
  const outer = new Uint8Array(64 + 32);
  outer.set(opad); outer.set(h, 64);
  return sha256(outer);
}

function encode(s: string): Uint8Array {
  const b: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) b.push(c);
    else if (c < 0x800) { b.push(0xc0 | (c >> 6)); b.push(0x80 | (c & 0x3f)); }
    else { b.push(0xe0 | (c >> 12)); b.push(0x80 | ((c >> 6) & 0x3f)); b.push(0x80 | (c & 0x3f)); }
  }
  return Uint8Array.from(b);
}

function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    out += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += (i + 1 < bytes.length) ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += (i + 2 < bytes.length) ? chars[b2 & 63] : '=';
  }
  return out;
}

// --- Geidea Session API ---

const SESSION_API =
  'https://api.merchant.geidea.net/payment-intent/api/v2/direct/Session';

const MERCHANT_PUBLIC_KEY = '99e20b62-2b76-4455-8b27-ef7a92d2d1b3';
const API_PASSWORD = 'c429331b-25fa-44b0-94a5-6d5a92e3ef75';

const BASIC_AUTH =
  'Basic OTllMjBiNjItMmI3Ni00NDU1LThiMjctZWY3YTkyZDJkMWIzOmM0MjkzMzFiLTI1ZmEtNDRiMC05NGE1LTZkNWE5MmUzZWY3NQ==';

function computeSignature(
  amount: number,
  currency: string,
  timestamp: string,
): string {
  const amountStr = amount.toFixed(2);
  const message = MERCHANT_PUBLIC_KEY + amountStr + currency + timestamp;
  return toBase64(hmacSHA256(API_PASSWORD, message));
}

export async function createSession(): Promise<string> {
  const timeStamp = new Date().toISOString();
  const amount = 740;
  const currency = 'EGP';
  const signature = computeSignature(amount, currency, timeStamp);

  const res = await fetch(SESSION_API, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: BASIC_AUTH,
      'Content-Type': 'application/json',
      OSVersion: '18.0',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone',
      deviceType: 'iPhone',
      language: 'en',
      sdkVersion: '1.0.0',
    },
    body: JSON.stringify({
      amount,
      appearance: {
        showAddress: false,
        showEmail: false,
        showPhone: false,
      },
      currency,
      initiatedBy: 'internet',
      order: {
        items: [
          {
            Price: 700,
            count: 1,
            icon: 'https://d23r9m22xg868b.cloudfront.net/public/navbar-hardware-1-egy-mobile.png',
            name: 'Geidea POS',
          },
        ],
        summary: {
          shipping: 20,
          subtotal: 700,
          vat: 20,
        },
      },
      paymentOperation: 'Pay',
      signature,
      timeStamp,
    }),
  });

  const data = await res.json();
  const id = data?.session?.id ?? data?.sessionId ?? data?.id;
  if (!id)
    throw new Error(
      data?.detailedResponseMessage ??
        data?.responseMessage ??
        'Failed to create session',
    );
  return id;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);