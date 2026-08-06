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
      'ss -tlnp | grep 3040; ufw status 2>/dev/null || true; iptables -L INPUT -n 2>/dev/null | head -10 || true; curl -s -o /dev/null -w "local login %{http_code}\\n" http://127.0.0.1:3040/login; curl -s -o /dev/null -w "public-ip login %{http_code}\\n" http://77.42.32.8:3040/login',
    ),
    (err, stream) => {
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', () => conn.end());
    },
  );
}).connect({ host: '77.42.32.8', username: 'arqam', password, readyTimeout: 30000 });
