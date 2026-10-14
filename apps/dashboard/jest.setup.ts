import { Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom';

function toNodeBuffer(source: BufferSource): Buffer {
  const values =
    'buffer' in source
      ? Array.from(new Uint8Array(source.buffer, source.byteOffset, source.byteLength))
      : Array.from(new Uint8Array(source));
  return Buffer.from(values);
}

// Node 24 Web Crypto rejects BufferSource values created in Jest's jsdom realm.
// Normalize inputs before the two methods used by the browser TOTP code.
const nodeSubtle = webcrypto.subtle;
const testSubtle = new Proxy(nodeSubtle, {
  get(target, property) {
    if (property === 'importKey') {
      return (
        _format: 'raw',
        keyData: BufferSource,
        algorithm: HmacImportParams,
        extractable: boolean,
        keyUsages: KeyUsage[],
      ) => target.importKey('raw', toNodeBuffer(keyData), algorithm, extractable, keyUsages);
    }
    if (property === 'sign') {
      return (algorithm: AlgorithmIdentifier, key: CryptoKey, data: BufferSource) =>
        target.sign(algorithm, key, toNodeBuffer(data));
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as SubtleCrypto;

const testCrypto = Object.create(webcrypto) as Crypto;
Object.defineProperty(testCrypto, 'subtle', { value: testSubtle });
Object.defineProperty(globalThis, 'crypto', { value: testCrypto, configurable: true });
