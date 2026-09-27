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
    const entrypoint = readFileSync(path.join(root, 'docker/api-entrypoint.sh'), 'utf8').replace(/\r/g, '');
    await writeRemote(conn, `${remoteDir}/docker/api-entrypoint.sh`, entrypoint);
    await exec(conn, sudoCmd(`chmod +x ${remoteDir}/docker/api-entrypoint.sh`));
    await exec(
      conn,
      sudoCmd(
        `sed -i 's/"80:80"/"3040:80"/' ${remoteDir}/docker/docker-compose.yml && sed -i 's|ENTRYPOINT \\["/entrypoint.sh"\\]|ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]|' ${remoteDir}/docker/Dockerfile.api && grep -q 'sed -i' ${remoteDir}/docker/Dockerfile.api || sed -i '/chmod +x \\/entrypoint.sh/a RUN sed -i '"'"'s/\\r$//'"'"' /entrypoint.sh' ${remoteDir}/docker/Dockerfile.api`,
      ),
    );
    await writeRemote(conn, `${remoteDir}/docker/.env`, readFileSync(path.join(root, 'docker/.env.production'), 'utf8'));
    await exec(conn, sudoCmd(`cd ${remoteDir}/docker && docker compose build api && docker compose up -d`));
    await exec(conn, sudoCmd(`cd ${remoteDir}/docker && docker compose ps && docker compose logs api --tail 25`));
    await exec(conn, `curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:3040/ || true`);
    console.log('\nApp: http://77.42.32.8:3040/');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
