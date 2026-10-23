import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = await deriveKey(password, salt);
  return `scrypt$32768$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, cost, salt, key] = stored.split('$');
  if (algorithm !== 'scrypt' || cost !== '32768' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  if (expected.length !== 64) return false;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected);
}

export function csrfToken(sessionToken: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionToken).digest('base64url');
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieValue(cookieHeader: string | undefined, name: string): string | null {
  const entry = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}
