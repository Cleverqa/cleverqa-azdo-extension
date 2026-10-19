Declares a release to [CleverQA](https://cleverqa.com) from Azure Pipelines, so crashes and incidents that follow are attributed to it.

```yaml
- task: CleverQADeclareRelease@1
  inputs:
    apiToken: $(CLEVERQA_TOKEN)
    project: my-project
    version: $(appVersion)
    platform: backend
```

`version` must be semver, such as `1.4.2`. The default Azure Pipelines build number (`20261019.1`) is not, so pass your app's version, or a `v1.4.2` tag (one leading `v` is stripped).

## Full pipeline

Declare the release when a version tag is built, after the build and deploy steps succeed:

```yaml
trigger:
  tags:
    include: ['v*']

pool:
  vmImage: ubuntu-latest

variables:
  - group: cleverqa              # holds the secret CLEVERQA_TOKEN
  - name: appVersion
    value: $[ replace(variables['Build.SourceBranch'], 'refs/tags/', '') ]

steps:
  - script: make test
  - script: make deploy

  - task: CleverQADeclareRelease@1
    name: cleverqa
    inputs:
      apiToken: $(CLEVERQA_TOKEN)
      project: my-project
      version: $(appVersion)       # v1.4.2 is sent as 1.4.2
      buildNumber: $(Build.BuildNumber)

  - script: echo "CleverQA release $(cleverqa.releaseId)"
```

Declaring the same project, version and platform again updates the existing release instead of creating a duplicate, so re-running a pipeline is safe.

## Inputs

| Name | Description | Required | Default |
|---|---|---|---|
| `apiToken` | CleverQA API token (`tok_...`) with the `releases:write` scope. Pass it from a secret variable. | yes | |
| `project` | Project slug, as it appears in the project URL | yes | |
| `version` | Semver version, e.g. `1.4.2`. One leading `v` is stripped. | yes | |
| `platform` | `backend`, `ios` or `android`. Must be enabled on the project. | no | `backend` |
| `buildNumber` | Build number | no | |
| `apiUrl` | CleverQA base URL. Only change this for self-hosted. | no | `https://cleverqa.com` |

## Output variable

| Name | Description |
|---|---|
| `releaseId` | The CleverQA release ID. Give the step a `name` and read it as `$(<name>.releaseId)`. |

## Failures

The task fails whenever the release is not recorded, and the log shows the HTTP status and CleverQA's reason. The token is never logged.

| Status | Usual cause |
|---|---|
| 400 | Version is not semver, or the platform is not enabled on the project |
| 401 | Token is wrong, revoked or expired |
| 402 | The workspace is on the Free plan; declaring releases needs Essentials or above |
| 403 | Token is missing the `releases:write` scope |
| 404 | No project with that slug in the token's workspace |

If declaring a release must never block your deploy, add `continueOnError: true` to the step.

## Where do I get a token?

In CleverQA, a workspace admin opens **Settings → API tokens**, creates a token with the `releases:write` scope, and copies it. It is shown once. Store it as a secret pipeline variable or in a variable group, e.g. `CLEVERQA_TOKEN`.

## What is CleverQA?

CleverQA turns monitor incidents, crash spikes, server saturation, load-test breakpoints and release regressions into one tracked defect with a likely cause attached. Declaring releases is what lets crashes and incidents attribute back to the release that caused them. See [cleverqa.com](https://cleverqa.com).

## Azure Boards

CleverQA also integrates with Azure Boards: it creates work items from defects, and work item status changes flow back to the CleverQA defect through a service hook. Set it up in CleverQA under **Integrations → Azure DevOps**.
