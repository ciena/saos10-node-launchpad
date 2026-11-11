export const DEFAULT_TRANSLATOR_URL = import.meta.env?.VITE_TRANSLATOR_URL || '';
export const DEFAULT_SAOS_VERSION = '10_12_00_0228';
const PROTOCOL_VERSION = '2025-06-18';

function decodeMessage(text, contentType) {
  const raw = contentType.includes('text/event-stream')
    ? text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
    : text;
  const message = JSON.parse(raw);
  if (message.error) throw new Error(`Translator MCP error ${message.error.code}: ${message.error.message}`);
  return message.result ?? {};
}

export async function validateSaosCli({ cli, saosVersion, platform, signal, fetchImpl = fetch, translatorUrl = DEFAULT_TRANSLATOR_URL }) {
  if (!cli.trim()) throw new Error('Enter SAOS CLI configuration before validating.');
  if (!/^\d+_\d+_\d+_\d+$/.test(saosVersion)) throw new Error('SAOS release must use the format 10_12_00_0228.');
  if (!/^[A-Za-z0-9_-]+$/.test(platform)) throw new Error('Enter a valid translator platform identifier, such as cn5164.');
  if (!translatorUrl) throw new Error('Remote SAOS Translator validation is not configured for this build; the configuration has not been validated.');
  let endpoint;
  try { endpoint = new URL(translatorUrl); }
  catch { throw new Error('The configured SAOS Translator endpoint is not a valid URL.'); }
  if (endpoint.protocol !== 'https:') throw new Error('The configured SAOS Translator endpoint must use HTTPS.');
  let requestId = 0;
  let sessionId = '';
  let validatorVersion = '';

  const post = async (method, params, notification = false) => {
    const body = { jsonrpc: '2.0', method, params };
    if (!notification) body.id = ++requestId;
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST', headers, body: JSON.stringify(body), signal, credentials: 'omit',
      });
    } catch (error) {
      if (signal?.aborted || !(error instanceof TypeError)) throw error;
      const local = globalThis.location?.protocol === 'file:';
      throw new Error(`Cannot reach the configured SAOS Translator. ${local
        ? 'This HTML file is open locally; online validation needs internet access and the service must allow browser requests from a local file (CORS origin "null").'
        : 'Online validation needs internet access and the service must allow requests from this page (CORS).'} Check network access. Your configuration has not been validated.`, { cause: error });
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`SAOS Translator returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    validatorVersion = response.headers.get('x-app-version') || validatorVersion;
    if (notification) return {};
    sessionId = response.headers.get('mcp-session-id') || sessionId;
    return decodeMessage(await response.text(), response.headers.get('content-type') || 'application/json');
  };

  await post('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'saos10-node-launchpad', version: 'standalone' },
  });
  await post('notifications/initialized', {}, true);
  const call = await post('tools/call', {
    name: 'validate_cli',
    arguments: { saos_version: saosVersion, platform, cli },
  });
  const text = Array.isArray(call.content)
    ? call.content.filter(item => item && typeof item.text === 'string').map(item => item.text).join('')
    : '';
  if (call.isError) throw new Error(text || 'SAOS Translator could not process the validation request.');
  let payload = call.structuredContent;
  if (!payload && text) {
    try { payload = JSON.parse(text); }
    catch (error) { throw new Error(`SAOS Translator returned invalid validation data: ${String(error)}`); }
  }
  if (!payload || typeof payload !== 'object' || !payload.result || typeof payload.result.valid !== 'boolean') {
    throw new Error('SAOS Translator response did not contain a validation verdict.');
  }
  return { ...payload.result, validatorVersion };
}
