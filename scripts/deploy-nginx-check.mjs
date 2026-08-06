import { Client } from 'ssh2';

const password = process.env.DEPLOY_PASS || '';

function sudoCmd(cmd) {
  const pass = password.replace(/'/g, `'\\''`);
  return `echo '${pass}' | sudo -S bash -lc ${JSON.stringify(cmd)}`;
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    sudoCmd(
      'nginx -t 2>&1; ls /etc/nginx/sites-enabled/ 2>/dev/null; head -40 /etc/nginx/sites-enabled/default 2>/dev/null || head -40 /etc/nginx/nginx.conf 2>/dev/null',
    ),
    (err, stream) => {
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', () => conn.end());
    },
  );
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
