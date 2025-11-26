import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const algorithm = 'aes-256-cbc';
const key = createHash('sha256').update(process.env.SELF_SALT!).digest();

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const result = Buffer.concat([iv, encrypted]);
  return result.toString('base64');
}

export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, 'base64');
  const iv = data.subarray(0, 16);
  const encryptedData = data.subarray(16);
  const decipher = createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}