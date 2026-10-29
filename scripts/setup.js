// Creates backend/.env and frontend/.env from the examples if they don't exist yet.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
for (const dir of ['backend', 'frontend']) {
  const env = path.join(root, dir, '.env');
  const example = path.join(root, dir, '.env.example');
  if (fs.existsSync(env)) { console.log(`${dir}/.env already exists, left unchanged`); continue; }
  let text = fs.readFileSync(example, 'utf8');
  if (dir === 'backend') text = text.replace('replace-with-a-long-random-string', crypto.randomBytes(48).toString('hex'));
  fs.writeFileSync(env, text);
  console.log(`Created ${dir}/.env`);
}
console.log('\nNext: check MONGO_URI in backend/.env, then run  npm run seed:demo  and  npm run dev');
