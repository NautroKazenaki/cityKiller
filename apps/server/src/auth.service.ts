import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { PersistenceService, UserRecord } from './persistence.service';

export interface PublicUser {
  id: string;
  login: string;
  createdAt: string;
}

type AuthResult = { ok: true; token: string; user: PublicUser } | { ok: false; error: string; status: number };

/** Буквы (в том числе кириллица), цифры, _ и -, от 3 до 20 символов */
const LOGIN_RE = /^[\p{L}\p{N}_-]{3,20}$/u;
const MIN_PASSWORD = 6;
const MAX_FAILURES = 5;
const LOCK_MS = 60_000;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** В базе лежит только хеш токена: утечка базы не даёт войти чужим входом */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toPublic(user: UserRecord): PublicUser {
  return { id: user.id, login: user.login, createdAt: user.createdAt };
}

@Injectable()
export class AuthService {
  /** Неудачные попытки входа по логину — простая защита от перебора пароля */
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(private readonly persistence: PersistenceService) {}

  register(login: unknown, password: unknown): AuthResult {
    const name = typeof login === 'string' ? login.trim() : '';
    const pass = typeof password === 'string' ? password : '';
    if (!LOGIN_RE.test(name)) {
      return { ok: false, status: 400, error: 'Логин: от 3 до 20 букв и цифр, можно _ и -' };
    }
    if (pass.length < MIN_PASSWORD || pass.length > 100) {
      return { ok: false, status: 400, error: `Пароль: не короче ${MIN_PASSWORD} символов` };
    }
    const id = randomUUID();
    const created = this.persistence.createUser({
      id,
      login: name,
      loginKey: name.toLowerCase(),
      passwordHash: hashPassword(pass)
    });
    if (!created) return { ok: false, status: 409, error: 'Такой логин уже занят' };
    const user = this.persistence.findUserByLoginKey(name.toLowerCase())!;
    return { ok: true, token: this.openSession(user.id), user: toPublic(user) };
  }

  login(login: unknown, password: unknown): AuthResult {
    const key = typeof login === 'string' ? login.trim().toLowerCase() : '';
    const pass = typeof password === 'string' ? password : '';
    const now = Date.now();
    const fail = this.failures.get(key);
    if (fail && fail.lockedUntil > now) {
      const seconds = Math.ceil((fail.lockedUntil - now) / 1000);
      return { ok: false, status: 429, error: `Слишком много попыток. Подождите ${seconds} с` };
    }

    const user = key ? this.persistence.findUserByLoginKey(key) : null;
    if (!user || !verifyPassword(pass, user.passwordHash)) {
      const count = (fail && fail.lockedUntil <= now && fail.count >= MAX_FAILURES ? 0 : fail?.count ?? 0) + 1;
      this.failures.set(key, { count, lockedUntil: count >= MAX_FAILURES ? now + LOCK_MS : 0 });
      // не уточняем, что именно неверно: так не подобрать существующие логины
      return { ok: false, status: 401, error: 'Неверный логин или пароль' };
    }
    this.failures.delete(key);
    return { ok: true, token: this.openSession(user.id), user: toPublic(user) };
  }

  userByToken(token: string | null | undefined): PublicUser | null {
    if (!token) return null;
    const user = this.persistence.findUserBySession(hashToken(token));
    return user ? toPublic(user) : null;
  }

  logout(token: string | null | undefined): void {
    if (token) this.persistence.deleteSession(hashToken(token));
  }

  private openSession(userId: string): string {
    const token = randomBytes(32).toString('hex');
    this.persistence.createSession(hashToken(token), userId);
    return token;
  }
}

/** «Bearer <token>» → token */
export function bearer(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match ? match[1] : null;
}
