export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error(`encode/fromHex: longueur impaire (${hex.length})`);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`encode/fromHex: caractère non-hex à la position ${i * 2}`);
    bytes[i] = byte;
  }
  return bytes;
}

export function toBase64url(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(b64url: string): Uint8Array {
  if (b64url.length === 0) return new Uint8Array();
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return new Uint8Array(Array.from(binary, (c) => c.charCodeAt(0)));
}
