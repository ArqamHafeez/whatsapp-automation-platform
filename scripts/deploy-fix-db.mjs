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
    await exec(
      conn,
      sudo(
        `cd ${remoteDir} && PG_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-) && docker compose exec -T postgres psql -U postgres -d whatsapp_platform -c "ALTER USER postgres PASSWORD '${'${PG_PASS}'}';"`,
      ),
    );
    await exec(conn, sudo(`cd ${remoteDir} && docker compose restart api && sleep 6 && docker compose ps && docker compose logs api --tail 35`));
    await exec(conn, `curl -s -o /dev/null -w "root HTTP %{http_code}\\n" http://127.0.0.1:3040/`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
