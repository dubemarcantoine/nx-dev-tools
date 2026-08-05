# tools-image-cleaner

Removes old images from a Google Artifact Registry package, keeping the most recent ones.

## Usage

```json
{
  "registry-clean": {
    "executor": "@nx-dev-tools/image-cleaner:clean",
    "options": {
      "location": "northamerica-northeast1",
      "repository": "my-repo",
      "package": "my-service",
      "keep": 10
    }
  }
}
```

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `location` | yes | — | Artifact Registry location. |
| `repository` | yes | — | Repository name. |
| `package` | yes | — | Package (image) name. |
| `keep` | no | `10` | How many of the most recent images to keep. |

### Why `keep` defaults to 10

These images are what a rollback rolls back *to*. `kubectl rollout undo` only helps if the image the
previous revision names is still in the registry, so pruning to the current build alone leaves a bad
release with nowhere to go.

The image currently tagged `latest` is never deleted, whatever its age and whatever `keep` is set to --
that one is serving traffic.

## Building

Run `nx build image-cleaner` to build the library.

## Running unit tests

Run `nx test image-cleaner` to execute the unit tests via [Jest](https://jestjs.io).
