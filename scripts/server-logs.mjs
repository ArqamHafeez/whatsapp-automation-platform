import { Client } from 'ssh2';
const password = process.env.DEPLOY_PASS || '';
const pass = password.replace(/'/g, `'\\''`);
const sudo = (cmd) => `echo '${pass}' | sudo -S bash -lc ${JSON.stringify(cmd)}`;
const conn = new Client();
conn.on('ready', () => {
  conn.exec(sudo('cd /home/arqam/whatsapp-platform/docker && docker compose logs api --tail 80'), (err, stream) => {
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '77.42.32.8', username: 'arqam', password });