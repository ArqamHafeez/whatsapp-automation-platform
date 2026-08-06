import { Client } from 'ssh2';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const password = process.env.DEPLOY_PASS || '';
const remoteDir = '/home/arqam/whatsapp-platform/docker';
const pgPass = 'a8f3c2e91b4d6f708e5c3a2b1d9e8f7c';

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
    const envContent = readFileSync(path.join(root, 'docker/.env.production'), 'utf8');
    await writeRemote(conn, `${remoteDir}/.env`, envContent);
    await exec(conn, sudoCmd(`ls -la ${remoteDir}/.env && head -3 ${remoteDir}/.env`));
    await exec(
      conn,
      sudoCmd(
        `cd ${remoteDir} && docker compose exec -T postgres psql -U postgres -d whatsapp_platform -c "ALTER USER postgres PASSWORD '${pgPass}';"`,
      ),
    );
    await exec(conn, sudoCmd(`cd ${remoteDir} && docker compose up -d api && sleep 8 && docker compose ps && docker compose logs api --tail 30`));
    await exec(conn, `curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:3040/`);
    console.log('\nLive: http://77.42.32.8:3040/');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
