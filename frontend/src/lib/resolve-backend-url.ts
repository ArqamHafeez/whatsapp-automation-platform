import { readFileSync } from 'node:fs';

/**
 * URL the Next.js server uses to reach Nest (not the browser).
 * On WSL2, Nest on Windows is reachable via the host IP in resolv.conf, not 127.0.0.1.
 */
export function resolveBackendUrl(): string {
  const fromEnv = process.env.BACKEND_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (process.platform === 'linux' && process.env.WSL_DISTRO_NAME) {
    try {
      const resolv = readFileSync('/etc/resolv.conf', 'utf8');
      const match = resolv.match(/^nameserver\s+(\S+)/m);
      if (match?.[1]) {
        return `http://${match[1]}:3000`;
      }
    } catch {
      // ignore
    }
  }

  return 'http://127.0.0.1:3000';
}
