# CleverQA Release for Azure Pipelines

Source for the **CleverQA Release** Azure DevOps extension (publisher `cleverqa`). It adds one pipeline task, `CleverQADeclareRelease@1`, which declares a release to CleverQA. The Marketplace listing is [`overview.md`](overview.md); the GitHub Action twin is [Cleverqa/cleverqa-release-action](https://github.com/Cleverqa/cleverqa-release-action).

## Releasing a new version

> **Every upload must bump the version in BOTH `vss-extension.json` and `DeclareRelease/task.json`.** The Marketplace rejects an unchanged version, and agents cache the task by its `task.json` version. Use the script, never edit one by hand:
>
> ```bash
> node bump-version.mjs patch     # or minor / major
> ```

```bash
cd DeclareRelease && npm ci --omit=dev && cd ..   # node_modules MUST ship in the VSIX
npx tfx-cli extension create --output-path dist
unzip -l dist/*.vsix | grep DeclareRelease/node_modules/azure-pipelines-task-lib   # must print lines
```

Upload the `.vsix` at https://marketplace.visualstudio.com/manage/publishers/cleverqa.

## Rules

- **Never change the task `id` in `task.json`** (`9fc5aac7-b588-4bf5-b7b2-bb05f614761c`). A new GUID is a different task and orphans every pipeline using this one.
- Keep `"public": false` in `vss-extension.json` until a version has run in a real pipeline in a test organisation.
- Never log the token. `index.js` calls `tl.setSecret` on it, and no request or error message includes headers.
- New features ship as new contributions (e.g. a release-score deployment gate) next to `declare-release-task` in `vss-extension.json`, each in its own folder. Do not grow this task beyond declaring a release.

## Layout

| Path | What |
|---|---|
| `vss-extension.json` | Extension manifest |
| `overview.md` | Marketplace listing |
| `images/icon.png` | Listing icon, 128×128 |
| `DeclareRelease/` | The task: `task.json`, `index.js`, `package.json` (+ `package-lock.json`) |
| `bump-version.mjs` | Bumps both versions together |

MIT licence.
