// Side-effect import: load .env.local before any module that reads process.env.
// (Next.js loads env itself; this is for standalone scripts like seed.ts.)
try {
  process.loadEnvFile(".env.local");
} catch {
  // env may already be provided (CI, production)
}
