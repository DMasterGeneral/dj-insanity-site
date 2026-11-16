// Grant a Firebase Auth user access to the DJ dashboard by writing admins/{uid}.
//   node scripts/make-admin.mjs --key <service-account.json> --uid <firebase auth uid> [--email <email>] [--production]
// Refuses the production project (dj-insanity) unless --production is passed.

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createClient, serverTimestamp } from '../functions/_lib/firestore.js';

const PRODUCTION_PROJECT = 'dj-insanity';
const USAGE =
  'Usage: node scripts/make-admin.mjs --key <service-account.json> --uid <firebase auth uid> [--email <email>] [--production]';

async function main() {
  const { values } = parseArgs({
    options: {
      key: { type: 'string' },
      uid: { type: 'string' },
      email: { type: 'string' },
      production: { type: 'boolean', default: false },
    },
  });
  if (!values.key || !values.uid) throw new Error(USAGE);
  const uid = values.uid.trim();
  if (!uid || uid.length > 128 || uid.includes('/')) throw new Error('The uid must be 1-128 characters with no "/".');

  const sa = JSON.parse(await readFile(values.key, 'utf8'));
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('That file is not a service-account key (needs project_id, client_email, private_key).');
  }

  console.log(`Project: ${sa.project_id}`);
  if (sa.project_id === PRODUCTION_PROJECT && !values.production) {
    throw new Error(`Refusing to write to the production project "${PRODUCTION_PROJECT}". Pass --production if you mean it.`);
  }

  const fs = createClient(sa);
  console.log(`Writing admins/${uid} ...`);
  await fs.patch(`admins/${uid}`, { email: values.email ? values.email.trim().toLowerCase() : null, createdAt: serverTimestamp });
  console.log('Done.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
