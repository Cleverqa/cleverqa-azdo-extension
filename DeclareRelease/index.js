// Declares a release to CleverQA: POST {apiUrl}/api/v1/releases.
// Same contract as the GitHub Action (Cleverqa/cleverqa-release-action).
// Only Node built-ins plus azure-pipelines-task-lib, so the VSIX stays small.

'use strict';

const http = require('node:http');
const https = require('node:https');

// Read the token BEFORE task-lib loads: on load it moves every INPUT_* env var
// into its vault, and tl.getInput() writes each value to the debug log
// (visible with System.Debug=true) before anything could mask it.
const RAW_API_TOKEN = (process.env.INPUT_APITOKEN || '').trim();

const tl = require('azure-pipelines-task-lib/task');

const TIMEOUT_MS = 30_000;
const RETRY_STATUSES = new Set([502, 503, 504]);

const HINTS = {
  400: 'check the version is semver and the platform is enabled on the project',
  401: 'check the token is current and not revoked',
  402: 'declaring releases needs the Essentials plan or above',
  403: 'the token needs the releases:write scope',
  404: 'no project with that slug in the token\'s workspace',
};

function readInputs() {
  if (!RAW_API_TOKEN) throw new Error('Input required: apiToken');
  // Masks the token in the log even when it was not passed as a secret variable.
  tl.setSecret(RAW_API_TOKEN);
  return {
    apiToken: RAW_API_TOKEN,
    project: tl.getInputRequired('project').trim(),
    version: tl.getInputRequired('version').trim().replace(/^[vV]/, ''),
    platform: (tl.getInput('platform') || 'backend').trim(),
    buildNumber: (tl.getInput('buildNumber') || '').trim(),
    apiUrl: (tl.getInput('apiUrl') || 'https://cleverqa.com').trim().replace(/\/+$/, ''),
  };
}

/** Request body with empty optional fields left out, never "" or null. */
function buildBody({ project, version, platform, buildNumber }) {
  return {
    project,
    version,
    platform,
    ...(buildNumber ? { buildNumber } : {}),
  };
}

function post(url, token, body) {
  const payload = JSON.stringify(body);
  const client = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: 'POST',
        timeout: TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'cleverqa-azdo-extension',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`no response within ${TIMEOUT_MS / 1000}s`)));
    req.on('error', reject);
    req.end(payload);
  });
}

// CleverQA treats (project, version, platform) as one release, so a retry
// after a dropped connection or a gateway error cannot create a duplicate.
async function postWithRetry(url, token, body) {
  try {
    const res = await post(url, token, body);
    if (!RETRY_STATUSES.has(res.status)) return res;
    console.log(`HTTP ${res.status}; retrying once`);
  } catch (err) {
    console.log(`Request failed (${err.message}); retrying once`);
  }
  return post(url, token, body);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function describeFailure(status, text) {
  const json = parseJson(text);
  const reason = json && json.error
    ? `${json.error.code}: ${json.error.message}`
    : text.slice(0, 2000);
  const hint = HINTS[status] || 'see the response above';
  return `CleverQA returned HTTP ${status}: ${reason} (${hint})`;
}

async function run() {
  const inputs = readInputs();
  const url = new URL(`${inputs.apiUrl}/api/v1/releases`);
  const label = `${inputs.project} ${inputs.version} (${inputs.platform})`;
  console.log(`Declaring ${label} to ${inputs.apiUrl}`);

  let res;
  try {
    res = await postWithRetry(url, inputs.apiToken, buildBody(inputs));
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, `Could not reach ${url.href}: ${err.message}`);
    return;
  }

  if (res.status < 200 || res.status >= 300) {
    tl.setResult(tl.TaskResult.Failed, describeFailure(res.status, res.text));
    return;
  }

  const json = parseJson(res.text);
  const id = json && json.data && json.data.id;
  if (!id) {
    tl.setResult(tl.TaskResult.Failed, `HTTP ${res.status} but the response had no release id: ${res.text.slice(0, 500)}`);
    return;
  }

  tl.setVariable('releaseId', id, false, true);
  const action = json.meta && json.meta.created ? 'Created' : 'Updated existing';
  tl.setResult(tl.TaskResult.Succeeded, `${action} CleverQA release ${label}: ${id}`);
}

run().catch((err) => {
  tl.setResult(tl.TaskResult.Failed, err.message);
});
