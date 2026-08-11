import fs from 'fs';

const file = process.argv[2] || '.env.development';
const text = fs.readFileSync(file, 'utf8');
const map = {};
for (const line of text.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  map[t.slice(0, i).trim()] = v;
}

const vite = map.VITE_CLERK_PUBLISHABLE_KEY || '';
const pub = map.CLERK_PUBLISHABLE_KEY || '';
const secret = map.CLERK_SECRET_KEY || '';

function info(name, v) {
  return {
    name,
    present: v.length > 0,
    len: v.length,
    prefix: v ? v.slice(0, 8) : null,
    looksTest: /pk_test|sk_test/.test(v),
    looksLive: /pk_live|sk_live/.test(v),
  };
}

console.log(
  JSON.stringify(
    {
      file,
      keys: [
        info('VITE_CLERK_PUBLISHABLE_KEY', vite),
        info('CLERK_PUBLISHABLE_KEY', pub),
        info('CLERK_SECRET_KEY', secret),
      ],
      publishableKeysMatch: vite.length > 0 && vite === pub,
      allConfigured: Boolean(vite && pub && secret),
    },
    null,
    2,
  ),
);
