import { Client } from 'ssh2';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const password = process.env.DEPLOY_PASS || '';
const remoteDir = '/home/arqam/whatsapp-platform';

function sudoCmd(cmd) {
  const pass = password.replace(/'/g, `'\\''`);
  return `echo '${pass}' | sudo -S bash -lc ${JSON.stringify(cmd)}`;
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
  });
}

function writeRemote(conn, remotePath, content) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  return exec(conn, sudoCmd(`echo '${b64}' | base64 -d > ${remotePath}`));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const conn = new Client();
conn.on('ready', async () => {
  try {
    await writeRemote(conn, `${remoteDir}/prisma/seed.js`, readFileSync(path.join(root, 'prisma/seed.js'), 'utf8'));
    await writeRemote(
      conn,
      `${remoteDir}/prisma/migrations/20260806100000_user_role/migration.sql`,
      readFileSync(path.join(root, 'prisma/migrations/20260806100000_user_role/migration.sql'), 'utf8'),
    );
    await exec(
      conn,
      sudoCmd(
        `mkdir -p ${remoteDir}/prisma/migrations/20260806100000_user_role && cd ${remoteDir}/docker && docker compose exec -T api npx prisma migrate deploy && docker compose exec -T api node prisma/seed.js`,
      ),
    );
    console.log('\nReviewer ready: reviewer@demo.com / reviewer123');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 60000 });
