export const generateKeyPair = jest.fn().mockReturnValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});
export const encryptBlob = jest.fn().mockResolvedValue(new Uint8Array(10));
export const decryptBlob = jest.fn().mockResolvedValue(new Uint8Array(10));
