import { Client } from 'ssh2';

const password = process.env.DEPLOY_PASS || '';
const pass = password.replace(/'/g, `'\\''`);
const sudo = (cmd) => `echo '${pass}' | sudo -S bash -lc ${JSON.stringify(cmd)}`;
const remoteDir = '/home/arqam/whatsapp-platform/docker';

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

const conn = new Client();
conn.on('ready', async () => {
  try {
    // Postgres volume was initialized with a different password — reset for fresh deploy
    await exec(conn, sudo(`cd ${remoteDir} && docker compose down`));
    await exec(conn, sudo(`docker volume rm docker_postgres_data 2>/dev/null || true`));
    await exec(conn, sudo(`cd ${remoteDir} && docker compose up -d`));
    await exec(conn, sudo(`sleep 8 && cd ${remoteDir} && docker compose ps && docker compose logs api --tail 40`));
    await exec(conn, `curl -s -o /dev/null -w "root HTTP %{http_code}\\n" http://127.0.0.1:3040/`);
    await exec(conn, `curl -s -o /dev/null -w "api HTTP %{http_code}\\n" http://127.0.0.1:3040/api/monitoring/health || curl -s http://127.0.0.1:3040/webhook/waha -X POST -H 'Content-Type: application/json' -d '{}' -w "\\nwebhook HTTP %{http_code}\\n" -o /dev/null || true`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
