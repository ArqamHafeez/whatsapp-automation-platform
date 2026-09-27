import { Client } from 'ssh2';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const password = process.env.DEPLOY_PASS || '';
const host = process.env.DEPLOY_HOST || '77.42.32.8';
const username = process.env.DEPLOY_USER || 'arqam';
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

function uploadFile(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.exec(`cat > ${remote}`, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`upload failed ${code}`))));
      import('node:fs').then(({ createReadStream }) => {
        createReadStream(local).on('error', reject).pipe(stream);
      });
    });
  });
}

const tarball = path.join(root, 'deploy-bundle.tgz');
execSync(
  `tar -czf "${tarball}" --exclude=node_modules --exclude=frontend/node_modules --exclude=frontend/.next --exclude=dist --exclude=.git --exclude=deploy-bundle.tgz -C "${root}" .`,
  { stdio: 'inherit', shell: true },
);

const envPath = path.join(root, 'docker', '.env.production');
if (!existsSync(envPath)) {
  writeFileSync(
    envPath,
    `POSTGRES_PASSWORD=${crypto.randomBytes(16).toString('hex')}
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
WAHA_API_KEY=${crypto.randomBytes(16).toString('hex')}
WEBHOOK_PUBLIC_URL=http://${host}:3040
AI_PROVIDER=mock
IMAGE_TAG=latest
`,
  );
} else {
  let env = readFileSync(envPath, 'utf8');
  if (!env.includes('3040')) {
    env = env.replace(/WEBHOOK_PUBLIC_URL=.*/, `WEBHOOK_PUBLIC_URL=http://${host}:3040`);
    writeFileSync(envPath, env);
  }
}
const envB64 = readFileSync(envPath).toString('base64');

const conn = new Client();
conn.on('ready', async () => {
  try {
    await uploadFile(conn, tarball, `${remoteDir}/deploy-bundle.tgz`);
    await exec(conn, sudoCmd(`cd ${remoteDir} && tar -xzf deploy-bundle.tgz && chmod +x docker/api-entrypoint.sh`));
    await exec(conn, sudoCmd(`mkdir -p ${remoteDir}/docker && echo ${envB64} | base64 -d > ${remoteDir}/docker/.env`));
    await exec(conn, sudoCmd(`cd ${remoteDir}/docker && docker compose build api frontend && docker compose up -d`));
    await exec(conn, sudoCmd(`cd ${remoteDir}/docker && docker compose ps`));
    await exec(conn, sudoCmd('cd /home/arqam/whatsapp-platform/docker && docker compose logs api --tail 20'));
    await exec(conn, 'curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:3040/ || true');
    console.log(`\nLive at: http://${host}:3040/`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host, username, password, readyTimeout: 30000 });
