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

const nodeSubtle = webcrypto.subtle;
const cryptoForTests = Object.create(webcrypto) as Crypto;

function importKey(
  format: 'jwk',
  keyData: JsonWebKey,
  algorithm:
    | AlgorithmIdentifier
    | RsaHashedImportParams
    | EcKeyImportParams
    | HmacImportParams
    | AesKeyAlgorithm,
  extractable: boolean,
  keyUsages: KeyUsage[],
): Promise<CryptoKey>;
function importKey(
  format: 'pkcs8' | 'raw' | 'spki',
  keyData: BufferSource,
  algorithm:
    | AlgorithmIdentifier
    | RsaHashedImportParams
    | EcKeyImportParams
    | HmacImportParams
    | AesKeyAlgorithm,
  extractable: boolean,
  keyUsages: KeyUsage[],
): Promise<CryptoKey>;
function importKey(
  format: KeyFormat,
  keyData: JsonWebKey | BufferSource,
  algorithm:
    | AlgorithmIdentifier
    | RsaHashedImportParams
    | EcKeyImportParams
    | HmacImportParams
    | AesKeyAlgorithm,
  extractable: boolean,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  if (format === 'jwk') {
    return nodeSubtle.importKey('jwk', keyData as JsonWebKey, algorithm, extractable, keyUsages);
  }
  return nodeSubtle.importKey(
    format,
    toNodeBuffer(keyData as BufferSource),
    algorithm,
    extractable,
    keyUsages,
  );
}

Object.defineProperty(cryptoForTests, 'subtle', {
  value: new Proxy(nodeSubtle, {
    get(target, property) {
      if (property === 'importKey') return importKey;
      if (property === 'sign') {
        return (
          algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
          key: CryptoKey,
          data: BufferSource,
        ) => target.sign(algorithm, key, toNodeBuffer(data));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }),
});
Object.defineProperty(globalThis, 'crypto', { value: cryptoForTests, configurable: true });
