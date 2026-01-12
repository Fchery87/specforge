import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../encryption';

describe('encryption', () => {
  const password = 'test-encryption-key-32-characters!';

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = encrypt(plaintext, password);
    const decrypted = decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time', () => {
    const plaintext = 'same-input';
    const encrypted1 = encrypt(plaintext, password);
    const encrypted2 = encrypt(plaintext, password);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  it('should fail to decrypt with wrong password', () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = encrypt(plaintext, password);
    const wrongPassword = 'wrong-password-32-characters!!';
    expect(() => decrypt(encrypted, wrongPassword)).toThrow();
  });
});
