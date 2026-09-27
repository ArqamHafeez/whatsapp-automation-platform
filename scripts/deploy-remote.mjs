/**
 * Remote deploy via SSH (password auth). Usage:
 *   DEPLOY_HOST=77.42.32.8 DEPLOY_USER=arqam DEPLOY_PASS=... node scripts/deploy-remote.mjs
 */
import { Client } from 'ssh2';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const host = process.env.DEPLOY_HOST || '77.42.32.8';
const username = process.env.DEPLOY_USER || 'arqam';
const password = process.env.DEPLOY_PASS || '';
const remoteDir = process.env.DEPLOY_DIR || '/home/arqam/whatsapp-platform';

if (!password) {
  console.error('Set DEPLOY_PASS environment variable');
  process.exit(1);
}

function sudoCmd(cmd) {
  const pass = password.replace(/'/g, `'\\''`);
  return `echo '${pass}' | sudo -S bash -lc ${JSON.stringify(cmd)}`;
}

function exec(conn, cmd, useSudo = false) {
  const run = useSudo ? sudoCmd(cmd) : cmd;
  return new Promise((resolve, reject) => {
    conn.exec(run, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        errOut += d.toString();
        process.stderr.write(d);
      });
      stream.on('close', (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(`Command failed (${code}): ${cmd}\n${errOut}`));
      });
    });
  });
}

function uploadFile(conn, local, remote) {
  return new Promise((resolve, reject) => {
    if (!existsSync(local)) {
      reject(new Error(`Local file missing: ${local}`));
      return;
    }
    const size = statSync(local).size;
    console.log(`Upload ${local} (${size} bytes) -> ${remote}`);
    conn.exec(`cat > ${remote}`, (err, stream) => {
      if (err) return reject(err);
      let errOut = '';
      stream.stderr.on('data', (d) => {
        errOut += d.toString();
      });
      stream.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Upload failed (${code}): ${errOut}`));
      });
      createReadStream(local).on('error', reject).pipe(stream);
    });
  });
}

function ensureEnv() {
  const envPath = path.join(root, 'docker', '.env.production');
  if (existsSync(envPath)) return readFileSync(envPath, 'utf8');

  const postgresPassword = crypto.randomBytes(16).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const wahaKey = crypto.randomBytes(16).toString('hex');
  const content = `# Auto-generated for server deploy
POSTGRES_PASSWORD=${postgresPassword}
JWT_SECRET=${jwtSecret}
WAHA_API_KEY=${wahaKey}
WEBHOOK_PUBLIC_URL=http://${host}
AI_PROVIDER=mock
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
IMAGE_TAG=latest
`;
  writeFileSync(envPath, content);
  return content;
}

const tarball = path.join(root, 'deploy-bundle.tgz');
console.log('Creating deploy bundle...');
execSync(
  `tar -czf "${tarball}" --exclude=node_modules --exclude=frontend/node_modules --exclude=frontend/.next --exclude=dist --exclude=.git --exclude=deploy-bundle.tgz -C "${root}" .`,
  { stdio: 'inherit', shell: true },
);

const conn = new Client();
conn
  .on('ready', async () => {
    try {
      console.log('Connected. Checking server...');
      let dockerOk = false;
      try {
        await exec(conn, 'docker --version && docker compose version');
        dockerOk = true;
      } catch {
        console.log('Installing Docker...');
        await exec(
          conn,
          'curl -fsSL https://get.docker.com | sh && usermod -aG docker $USER || true',
          true,
        );
        await exec(
          conn,
          'apt-get update && apt-get install -y docker-compose-plugin',
          true,
        );
        dockerOk = true;
      }
      if (!dockerOk) throw new Error('Docker not available');
      await exec(conn, `mkdir -p ${remoteDir}`);

      const remoteTar = `/tmp/whatsapp-deploy-bundle.tgz`;
      await uploadFile(conn, tarball, remoteTar);
      await exec(conn, `mv -f ${remoteTar} ${remoteDir}/deploy-bundle.tgz`);

      const envContent = ensureEnv();
      const envB64 = Buffer.from(envContent, 'utf8').toString('base64');
      await exec(
        conn,
        `mkdir -p ${remoteDir}/docker && echo ${envB64} | base64 -d > ${remoteDir}/docker/.env`,
      );

      console.log('Extracting and starting containers (this may take several minutes)...');
      await exec(
        conn,
        `cd ${remoteDir} && tar -xzf deploy-bundle.tgz && chmod +x docker/deploy.sh docker/api-entrypoint.sh && cd docker && docker compose build && docker compose up -d && docker compose ps`,
        true,
      );

      console.log('\nDeploy complete.');
      console.log(`Dashboard: http://${host}/`);
      console.log(`Webhook base: http://${host} (path /webhook/waha)`);
      console.log(`Secrets saved locally in docker/.env.production — copy WAHA_API_KEY from there for reference.`);
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    } finally {
      conn.end();
    }
  })
  .on('error', (err) => {
    console.error('SSH error:', err.message);
    process.exit(1);
  })
  .connect({
    host,
    port: 22,
    username,
    password,
    readyTimeout: 30000,
  });
