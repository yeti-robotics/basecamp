export function decodeSeed(base32: string): Uint8Array {
  const normalized = base32.toUpperCase().replace(/=+$/, '');
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid Base32 seed');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
  }
  if (bytes.length < 20) throw new Error('TOTP seed must contain at least 20 bytes');
  return Uint8Array.from(bytes);
}

export async function generateAttendanceCode(
  base32: string,
  timestampMs = Date.now(),
): Promise<string> {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error('Invalid time');
  const seed = new Uint8Array(decodeSeed(base32));
  const key = await crypto.subtle.importKey('raw', seed, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(timestampMs / 30_000)));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = hash[hash.length - 1]! & 15;
  const value =
    (new DataView(hash.buffer, hash.byteOffset, hash.byteLength).getUint32(offset) & 0x7fffffff) %
    10_000;
  return String(value).padStart(4, '0');
}
