import { Client } from 'ssh2';

const password = process.env.DEPLOY_PASS || '';
const remoteDir = '/home/arqam/whatsapp-platform/docker';

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

const conn = new Client();
conn.on('ready', async () => {
  try {
    await exec(
      conn,
      sudoCmd(
        `cd ${remoteDir} && docker compose config | grep DATABASE_URL && docker compose up -d --force-recreate api && sleep 10 && docker compose ps && docker compose logs api --tail 40`,
      ),
    );
    await exec(conn, `curl -s http://127.0.0.1:3040/login -o /dev/null -w "login HTTP %{http_code}\\n"`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
