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
    await exec(conn, sudoCmd(`cd ${remoteDir} && docker compose exec -T api node prisma/seed.js`));
    await exec(
      conn,
      `curl -s -X POST http://127.0.0.1:3040/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@demo.com","password":"admin123"}' | head -c 200; echo`,
    );
    await exec(conn, `curl -s -o /dev/null -w "public login page HTTP %{http_code}\\n" http://77.42.32.8:3040/login`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
