import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { betterAuth } from 'better-auth'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'identity.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// better-auth 1.6.x does NOT auto-migrate better-sqlite3 — create the core
// schema explicitly (same DDL as TechDeck's db.ts, proven against 1.6.x).
db.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" INTEGER NOT NULL,
    "image" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TEXT,
    "refreshTokenExpiresAt" TEXT,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_user ON "session"("userId");
  CREATE INDEX IF NOT EXISTS idx_account_user ON "account"("userId");
`)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'https://identity.ffilt.us',
  secret: process.env.BETTER_AUTH_SECRET,
  database: db,
  // User/pass only — Reed: "allows creation of user/pass logins with
  // no email verification" (2026-08-03).
  emailAndPassword: {
    enabled: true,
    enableEmailVerification: false,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  // Apps that proxy auth through us (CSRF origin check).
  trustedOrigins: [
    'https://identity.ffilt.us',
    'http://identity.ffilt.us',
    'https://techdeck.ffilt.us',
    'http://techdeck.ffilt.us',
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  advanced: {
    // useSecureCookies: false — LAN http via split-DNS must work; the
    // __Secure- prefix (auto-added when baseURL is https) makes browsers
    // reject the cookie over plain http → LAN login broken (2026-08-04).
    useSecureCookies: false,
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: false, // LAN http via split-DNS + CF edge TLS terminates upstream
    },
    // Traefik is the only proxy; CF sets cf-connecting-ip on tunneled traffic.
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      trustedProxies: ['127.0.0.1', '10.42.0.0/16'],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 3600, max: 20 },
    },
  },
})

export { toNodeHandler, fromNodeHeaders }
