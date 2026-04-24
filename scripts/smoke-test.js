/*
  Minimal smoke test (node) - run after setting env vars and starting supabase
  Requires: node-fetch or use node 18+ global fetch
*/
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('Smoke test placeholder - implement on local dev with your supabase credentials');
}

main().catch(e => { console.error(e); process.exit(1); });
