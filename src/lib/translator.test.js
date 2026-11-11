import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TRANSLATOR_URL, validateSaosCli } from './translator.js';
const testTranslatorUrl = 'https://translator.example.invalid/mcp';

test('no translator endpoint is hard-coded into the public build', () => {
  assert.equal(DEFAULT_TRANSLATOR_URL, '');
});

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'x-app-version': '4.2.0' },
  });
}

test('translator validates through its MCP handshake and preserves the target context', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    const body = JSON.parse(options.body);
    if (body.method === 'initialize') return response({ result: { protocolVersion: '2025-06-18' } });
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return response({ result: { content: [{ type: 'text', text: JSON.stringify({ result: {
      valid: true, message: 'Configuration is valid.', details: [],
    } }) }] } });
  };

  const result = await validateSaosCli({
    cli: 'config\nsystem config hostname edge-1\nexit',
    saosVersion: '10_12_00_0228',
    platform: 'cn3984',
    fetchImpl,
    translatorUrl: testTranslatorUrl,
  });

  assert.equal(result.valid, true);
  assert.equal(result.validatorVersion, '4.2.0');
  assert.deepEqual(requests.map(request => request.body.method), [
    'initialize', 'notifications/initialized', 'tools/call',
  ]);
  assert.equal(requests[2].url.href, testTranslatorUrl);
  assert.deepEqual(requests[2].body.params, {
    name: 'validate_cli',
    arguments: {
      saos_version: '10_12_00_0228',
      platform: 'cn3984',
      cli: 'config\nsystem config hostname edge-1\nexit',
    },
  });
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests[0].options.headers['mcp-protocol-version'], '2025-06-18');
});

test('translator surfaces transport failures instead of returning a validation verdict', async () => {
  await assert.rejects(validateSaosCli({
    cli: 'config',
    saosVersion: '10_12_00_0228',
    platform: 'cn5164',
    translatorUrl: testTranslatorUrl,
    fetchImpl: async () => response({ error: 'unavailable' }, 503),
  }), /HTTP 503/);
});

test('translator rejects invalid target fields before making a network request', async () => {
  let called = false;
  await assert.rejects(validateSaosCli({
    cli: 'config',
    saosVersion: '10.12',
    platform: 'cn5164',
    fetchImpl: async () => { called = true; return response({}); },
  }), /SAOS release must use the format/);
  assert.equal(called, false);
});

test('translator must be configured and use HTTPS before sending configuration', async () => {
  let called = false;
  await assert.rejects(validateSaosCli({
    cli: 'config', saosVersion: '10_12_00_0228', platform: 'cn3984',
    fetchImpl: async () => { called = true; return response({}); },
  }), /not configured.*not been validated/);
  await assert.rejects(validateSaosCli({
    cli: 'config', saosVersion: '10_12_00_0228', platform: 'cn3984',
    translatorUrl: 'http://translator.example.invalid/mcp',
    fetchImpl: async () => { called = true; return response({}); },
  }), /must use HTTPS/);
  assert.equal(called, false);
});

test('browser network errors explain CORS without returning a validation verdict', async () => {
  await assert.rejects(validateSaosCli({
    cli: 'config',
    saosVersion: '10_12_00_0228',
    platform: 'cn3984',
    translatorUrl: testTranslatorUrl,
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  }), /Cannot reach.*internet access.*CORS.*not been validated/);
  const controller = new AbortController();
  controller.abort();
  const aborted = new DOMException('Request aborted', 'AbortError');
  await assert.rejects(validateSaosCli({
    cli: 'config', saosVersion: '10_12_00_0228', platform: 'cn3984', signal: controller.signal,
    translatorUrl: testTranslatorUrl,
    fetchImpl: async () => { throw aborted; },
  }), error => error === aborted);
});
