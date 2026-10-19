// Bump the extension version in vss-extension.json AND DeclareRelease/task.json
// together. The Marketplace rejects an upload whose version did not go up, and
// agents cache tasks by task.json version, so both must move on every publish.
//
//   node bump-version.mjs patch|minor|major
//
// A major bump means a breaking task change: users pin CleverQADeclareRelease@1,
// so a 2.x task should normally ship as a NEW task folder alongside the old one.

import { readFileSync, writeFileSync } from 'node:fs';

const part = process.argv[2];
if (!['patch', 'minor', 'major'].includes(part)) {
  console.error('usage: node bump-version.mjs patch|minor|major');
  process.exit(2);
}

const MANIFEST = 'vss-extension.json';
const TASK = 'DeclareRelease/task.json';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const task = JSON.parse(readFileSync(TASK, 'utf8'));

const [major, minor, patch] = manifest.version.split('.').map(Number);
const current = task.version;
if (current.Major !== major || current.Minor !== minor || current.Patch !== patch) {
  console.error(`versions disagree: ${MANIFEST} ${manifest.version}, ${TASK} ${current.Major}.${current.Minor}.${current.Patch}`);
  process.exit(1);
}

const next =
  part === 'major' ? [major + 1, 0, 0]
  : part === 'minor' ? [major, minor + 1, 0]
  : [major, minor, patch + 1];

const updatedManifest = { ...manifest, version: next.join('.') };
const updatedTask = { ...task, version: { Major: next[0], Minor: next[1], Patch: next[2] } };

writeFileSync(MANIFEST, `${JSON.stringify(updatedManifest, null, 2)}\n`);
writeFileSync(TASK, `${JSON.stringify(updatedTask, null, 2)}\n`);
console.log(`${manifest.version} -> ${next.join('.')}`);
