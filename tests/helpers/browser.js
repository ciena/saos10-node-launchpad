import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

function processGroupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && processGroupExists(pid)) await delay(50);
  return !processGroupExists(pid);
}

export async function runBrowserChecks(browser, { userDataDir, width, url, timeoutMs, flags = [] }) {
  const child = spawn(browser, [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`, `--window-size=${width},1000`, ...flags, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-8000); });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let socket;
  const browserErrors = [];
  const pending = new Map();
  let nextId = 0;
  const portFile = `${userDataDir}/DevToolsActivePort`;
  let port = 0;
  try {
    const startupDeadline = Date.now() + 15000;
    while (Date.now() < startupDeadline && !port) {
      if (existsSync(portFile)) {
        const candidate = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
        if (Number.isInteger(candidate) && candidate > 0) port = candidate;
      }
      if (port) break;
      const exit = await Promise.race([exited, delay(50).then(() => null)]);
      if (exit) throw new Error(`Chromium exited before remote debugging started (${JSON.stringify(exit)}): ${stderr}`);
    }
    if (!port) throw new Error(`Chromium did not expose a valid debugging port: ${stderr}`);
    const targetsResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!targetsResponse.ok) throw new Error(`Chromium target list returned HTTP ${targetsResponse.status}`);
    const targets = await targetsResponse.json();
    const target = targets.find(item => item.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('Chromium did not expose a page target');

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Could not connect to Chromium DevTools')), { once: true });
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.method === 'Runtime.exceptionThrown')
        browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (!message.id) return;
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      if (message.error) call.reject(new Error(message.error.message));
      else call.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url });
    const deadline = Date.now() + timeoutMs;
    let lastState = 'no response';
    while (Date.now() < deadline) {
      const result = await send('Runtime.evaluate', {
        expression: "JSON.stringify({result:document.querySelector('#flow-result, #layout-result')?.textContent || '',done:document.querySelector('#flow-result, #layout-result')?.dataset.done === 'true',href:location.href,readyState:document.readyState,body:document.body?.innerText.slice(-300)})",
        returnByValue: true,
      });
      const state = result.result?.value;
      if (typeof state === 'string') {
        const page = JSON.parse(state);
        lastState = `${page.href} (${page.readyState}) result=${page.result || 'missing'} body=${page.body || ''}`;
        if (page.done) return page.result;
      }
      const exit = await Promise.race([exited, delay(50).then(() => null)]);
      if (exit) throw new Error(`Chromium exited before the page reported a result (${JSON.stringify(exit)}): ${stderr}`);
    }
    throw new Error(`Browser checks did not report a result within ${timeoutMs}ms. Page: ${lastState}. JS errors: ${browserErrors.join(' | ')}. Chromium: ${stderr}`);
  } finally {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (child.exitCode === null && child.signalCode === null && port) {
      let closeSocket;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          const { webSocketDebuggerUrl } = await response.json();
          closeSocket = new WebSocket(webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timed out connecting to Chromium for shutdown')), 2000);
            closeSocket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
            closeSocket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to Chromium for shutdown')); }, { once: true });
          });
          await Promise.race([
            new Promise(resolve => {
              const finish = () => resolve();
              closeSocket.addEventListener('message', finish, { once: true });
              closeSocket.addEventListener('close', finish, { once: true });
              closeSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
            }),
            delay(3000),
          ]);
        }
      } catch {
        // Fall back to terminating Chromium if its debugging endpoint is unavailable.
      } finally {
        if (closeSocket?.readyState === WebSocket.OPEN) closeSocket.close();
      }
    }
    if (child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else {
        try { process.kill(-child.pid, 'SIGTERM'); }
        catch (error) { if (error?.code !== 'ESRCH') throw error; }
      }
    }
    const stopped = process.platform === 'win32'
      ? Boolean(await Promise.race([exited, delay(3000).then(() => null)]))
      : await waitForProcessGroupExit(child.pid, 3000);
    if (!stopped) {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error?.code !== 'ESRCH') throw error; }
        if (!await waitForProcessGroupExit(child.pid, 3000))
          throw new Error('Chromium process group did not exit after SIGKILL; temporary profile was retained.');
      }
    }
    await exited;
  }
}
