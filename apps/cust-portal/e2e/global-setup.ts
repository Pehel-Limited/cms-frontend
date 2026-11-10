import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Resets then re-seeds the sandbox personas so every run starts from the same state. */
export default async function globalSetup() {
  const script = path.resolve(__dirname, '../../../../cms-backend/database/seed-retail-connects-demo.sh');
  const env = { ...process.env, APP_ENV: process.env.APP_ENV ?? 'local' };
  execFileSync('bash', [script, '--reset'], { env, stdio: 'inherit' });
  execFileSync('bash', [script], { env, stdio: 'inherit' });
}
