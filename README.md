# Uno Browser Extension

## Developing

### Quick Start

The project builds with:

```zsh
make
```

This runs the default `debug` target, which builds an optimized bundle using [`dev.env`](./env/dev.env) variables.

To start a hot-reloading build server with those same `dev.env` variables, run:

```zsh
make watch
```

### Run

Build output is written to `./$(OUTDIR)` if `OUTDIR` is a relative path, or just `OUTDIR` if the path is absolute. The default is `./dist`.

#### Chrome

- In Chrome navigate to the `chrome://extensions` page, and
- enable "Developer mode" using the toggle in the upper right.
- Then, select "Load unpacked" in the upper left, and
- select the `dist` directory.

#### Firefox

- In Firefox navigate to the `about:debugging` page, and
- select the "Load Temporrary Add-on..." button.
- Select the `dist/manifest.json` file and open it.

#### Safari

The Safari extension is integrated via the macOS (and iOS) app.

- Push your changes to a branch in this repo, and
- use `git-subtree` to pull in your branch as described in the `Uno-iOS` README.
- Open the `Uno.xcodeproj` file and run the `Uno (macOS)` scheme.
- Once the build launches, the extension will be available in Safari settings.
- If the extension does not show up, then you need to allow unsigned extensions.
- Under the `Advanced` settings tab, check "Show Develop menu in menu bar".
- Then at the bottom of the `Develop` menu, select: "Allow Unsigned Extensions".
- Navigate to the `Extensions` tab and enable the Uno browser extension.

### VSCode Workspace Setup _(optional)_

#### Recommended Extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

#### Optimal Settings:

```js
{
  // A listing of language IDs which should be validated by ESLint.
  // NOTE: If not installed, ESLint will show an error.
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],

  // ESLint rules that should be executed when computing `codeActionsOnSave`.
  // You can ignore rules using glob patterns (e.g.: "!@typescript-eslint/no-unsafe-assignment").
  "eslint.codeActionsOnSave.rules": [
    "*",
    "!@typescript-eslint/*"
  ],

  // Code actions to be executed upon save.
  //
  // NOTE: To improve performance, code actions
  // should be "opt-in" on a per-extension basis.
  "editor.codeActionsOnSave": {
    "source.fixAll": false,
    "source.organizeImports": false,
    "source.fixAll.eslint": true,
  },
}
```

### Convenient Makefile Targets

#### Dependencies

Dependencies are managed as Node modules.
You can download and update dependencies without doing a full build using:

```zsh
make deps
```

#### Testing

For unit-tests, we use [Jest](https://jestjs.io/) as our test-runner and assertion framework. To run unit tests, use:

```zsh
make test
```

For integration tests, we use [Playwright](https://playwright.dev/) as our test-runner and assertion framework. To run integration tests, use:

```zsh
make e2e
```

To view the last integration test report, run:

```zsh
make e2e.report
```

#### Checks

TypeScript and ESLint are used to keep the code tidy.

TypeScript will automatically check for static type errors at build-time. However, you can manually perform type-checking with:

```zsh
make typecheck
```

Linting is integrated with the developer experience using a compatible IDE (e.g.: VSCode). However, linting can also be performed manually from your preferred shell with:

```zsh
make lint
```

ESLint can even fix some errors automatically, including prettifying source code. Just run:

```zsh
make format
```

#### Clean

Remove compiled sources (`OUTDIR`) using:

```zsh
make clean
```

Clobber `node_modules` as well using:

```zsh
make clobber
```

### Debug

By default, development builds target our *internal production* server at `https://api.u1o.dev`. Additionally:

- Analytics events go to a distinct development source in segment, but are not forwarded to amplitude or customer.io.
- Sentry errors are tagged as coming from the `development` environment.
- Native messaging uses the `local.uno.native_host` application specifier.
- OAuth for Peekaboo happens using the `internal` client-id and credentials.
- Feedback does not get published to the associated channel in Discord.

### Integrating Changes

Generally, the above settings are appropriate for day-to-day development where you are making isolated changes to extension code. But sometimes you need to integrate a new feature including changes from the API server.

Here's how you can approach this scenario:

- Grab a preview URL for an API-related PR in the [withuno/identity](https://github.com/withuno/identity/pulls) repo. You can find the URL by clicking on the DigitalOcean deployment link in a comment from our `gh-workflow` bot.
- Once the initial preview deployment has completed, grab the `ondigitalocean.app` link near the top of the page.
- Set the `API_SERVER` environment variable to the value you just copied, then...
- Build the extension!

For example:

```zsh
make debug API_SERVER="https://identity-pr-102-lb4e4.ondigitalocean.app/"
```

#### Local

For convenience, there's a dedicated make command to build the extension targeting `http://localhost:8080`, which is where our local API server listens by default.

If you need to target a local instance of the API server, run:

```zsh
make local
```

### Using NPM scripts directly

Using `make` will automatically install dependencies and run builds, but you can also manually call into NPM scripts for more granular control. First, install dependencies:

```zsh
npm install
```

Then, select your flavor of build server:

- `watch` for hot-reloading development, or...
- `build` for optimized bundling.

and pair with an environment variant:

- [`dev.env`](./env/dev.env) — for local debugging/development using `https://api.u1o.dev` as the API server.
- [`e2e.env`](./env/e2e.env) — for use in automated integration testing.
- [`local.env`](./env/local.env) — for local debugging/development using `http://localhost:8080` as the API server.
- [`internal.env`](./env/internal.env) — for distributing internal staging releases.
- [`prod.env`](./env/prod.env) — for distributing production releases.

The available commands are:

```zsh
npm run watch.dev
npm run watch.e2e
npm run watch.local
npm run watch.internal
npm run watch.prod

npm run build.dev
npm run build.e2e
npm run build.local
npm run build.internal
npm run build.prod
```

## Releasing

We have two live environments: `internal` and `production`.

Both are full copies of our infrastructure and should be as identical as possible. The only difference is the domain name (and compute resources).

The `internal` infrastructure is hosted at `https://api.u1o.dev`, while `production` infrastruction is hosted at `https://api.uno.app`.

While developing, you create `local`, `debug`, or `watch` builds. When publishing a release, however, you create `internal` or `release` builds.

A good rule of thumb is: _development_ builds are for yourself, while `internal` and `production` _release_ builds are for others (either teammates internally, or general users, publicly).
However, don't hesitate to use an `internal` build if you need to test on live infrastructure (e.g. analytics, marketing, etc.).

### Internal

Internal production releases can be made using:

```zsh
make internal
```

Send these to the team to try out new features for feedback and QA.

It's okay to use `internal` builds liberally. If you just added a new feature and need to build the analytics dashboard, make yourself an internal build to test on.

### Production

External production releases can be made using:

```zsh
make release
```

An archive of build outputs will be created automatically with a name like `uno-v1.x.x.zip`, reflecting the version number injected into the extension manifest. This artifact can be uploaded directly to the appropriate browser extension web store.

To archive any build target automatically, you can set `PACKAGE=true` in your local environment. For example:

```zsh
make debug PACKAGE=true
```

### Continuous Delivery

Our team is working to incrementally develop a robust Continuous Delivery pipeline for the web extension. The following release tasks are currently automated by CI/CD:

- Bump the patch version of the extension (e.g.: `v1.0.1 -> v1.0.2`).
    - For merges into `next`, a pre-release tag is appended to the version like `v1.0.1 -> v1.0.2-next.0 -> v1.0.2-next.1 -> ...`.
- Builds the extension for an external release, then archives those deliverable outputs and the original source code.
    - For merges into `next`, an `internal` release is created.
    - For merges into `main`, a `production` release is created.
- Release notes are generated automatically, along with a tagged GitHub release.

When cutting a new release, download the artifacts from the relevant [Internal or Production Release](https://github.com/withuno/chrome-extension/releases)

In the future, we have plans to move the following manual tasks into CI/CD:

- Automatic publishing to the Chrome and Firefox extension storefronts.
- Automatic unit and integration testing against all PRs.

## Updating the Vault Schema

The vault schema is hosted on Github at [withuno/vault_schema](https://github.com/withuno/vault_schema).
To update the schema:

1. change the tag version for `@withuno/vault-schema` in [package.json](./package.json).
2. **Then run:** `npm update @withuno/vault-schema` *and,*
3. `npm install @withuno/vault-schema`.
4. Confirm, in [package-lock.json](./package-lock.json), that both `resolved` and `version` have changed, and that `from` indicates the correct tag version.
