# Dokploy Deployment Notes

This app is deployed as a simple SPA on Dokploy using Nixpacks to build `dist`, then Dokploy's static publish-directory flow serves that directory with NGINX.

## Live App

- URL: <https://qr.0xott.cloud>
- Dokploy project: `QR`
- Dokploy app: `web`
- Git source: `AlexanderHott/qr`
- Branch: `main`
- Build type: `nixpacks`
- Publish directory: `./dist`
- Static SPA: enabled
- Internal port: `80`

## Repo Changes

I added:

- `.dockerignore` to keep local build artifacts and `node_modules` out of the Docker/Nixpacks context.
- `nixpacks.toml` to define the install and build commands.

I initially ran the app with `vp preview` on port `3000`, which required `preview.allowedHosts` in `vite.config.ts`. That was removed after switching to Dokploy's static publish-directory flow.

## Nixpacks Setup

The default Nixpacks Node provider was not enough for this repo:

- Nixpacks defaulted to Node 18.
- `nodejs_22` from the pinned Nixpacks image resolved to Node `22.3.0`.
- `pnpm@11.5.3` requires at least Node `22.13`.
- `nodejs_24` was not available in that pinned Nix archive.

The final `nixpacks.toml` uses `nodejs_22` only as a bootstrap, installs Node `24.16.0` with `n`, installs `pnpm@11.5.3`, then builds the SPA:

```bash
pnpm build
```

## Dokploy Steps Used

1. Created a Dokploy project named `QR`.
2. Created an application named `web`.
3. Connected the app to GitHub provider `AlexanderHott/qr` on `main`.
4. Set build type to `nixpacks`.
5. Set publish directory to `./dist`.
6. Enabled static SPA serving.
7. Added domain `qr.0xott.cloud` with HTTPS on internal port `80`.
8. Triggered a deployment from Dokploy.

I first tried running `vp preview` as the app process:

```bash
pnpm exec vp preview --host 0.0.0.0 --port 3000
```

That deployed, but the first public check returned:

```text
Blocked request. This host ("qr.0xott.cloud") is not allowed.
```

That happened because public traffic reached Vite's preview server with `Host: qr.0xott.cloud`. The better fix for this static SPA was not to keep `preview.allowedHosts`, but to switch to Dokploy's static publish-directory flow.

## Commands Used

Git/GitHub commands:

```bash
git remote -v
git add .dockerignore nixpacks.toml
git commit -m "Add Nixpacks deployment config"
git push origin main

git add vite.config.ts
git commit -m "Allow Dokploy preview host"
git push origin main

git add DEPLOYMENT.md nixpacks.toml vite.config.ts
git commit -m "Use Dokploy static publish directory"
git push origin main
```

Dokploy discovery commands:

```bash
dokploy project all --json
dokploy github github-providers --json
dokploy application create --help
dokploy application save-github-provider --help
dokploy application save-build-type --help
dokploy domain create --help
```

Dokploy project and app creation:

```bash
dokploy project create \
  --name QR \
  --description "QR SPA" \
  --json

dokploy application create \
  --name web \
  --description "QR SPA" \
  --environmentId gtlTG_xC5z6C0JQU_Mlef \
  --json
```

The created IDs were:

```text
projectId: 5q53-mTsUN-8Hwac6vYyr
environmentId: gtlTG_xC5z6C0JQU_Mlef
applicationId: 4z78kzStFIRqapV8SZICm
githubId: _UMpWiqrOtMrBEqgi0DPo
```

The Dokploy CLI's `save-github-provider` command returned `400` unless `enableSubmodules` was sent explicitly. I used the CLI's authenticated API client directly for that part:

```bash
node --input-type=module <<'NODE'
import { createClient } from "/home/ott/.local/share/pnpm/global/v11/2e420-19eb489f949/node_modules/@dokploy/cli/dist/client.js";

const client = createClient();

async function post(endpoint, json) {
  const res = await client.post(`/trpc/${endpoint}`, { json });
  console.log(endpoint, JSON.stringify(res.data?.result?.data?.json ?? res.data, null, 2));
}

await post("application.saveGithubProvider", {
  applicationId: "4z78kzStFIRqapV8SZICm",
  repository: "qr",
  owner: "AlexanderHott",
  buildPath: "/",
  githubId: "_UMpWiqrOtMrBEqgi0DPo",
  branch: "main",
  triggerType: "push",
  enableSubmodules: false,
  watchPaths: [],
});

await post("application.saveBuildType", {
  applicationId: "4z78kzStFIRqapV8SZICm",
  buildType: "nixpacks",
  dockerfile: null,
  dockerContextPath: null,
  dockerBuildStage: null,
  herokuVersion: null,
  railpackVersion: null,
  publishDirectory: "./dist",
  isStaticSpa: true,
});
NODE
```

Domain creation:

```bash
node --input-type=module <<'NODE'
import { createClient } from "/home/ott/.local/share/pnpm/global/v11/2e420-19eb489f949/node_modules/@dokploy/cli/dist/client.js";

const client = createClient();

const res = await client.post("/trpc/domain.create", {
  json: {
    host: "qr.0xott.cloud",
    path: "/",
    port: 80,
    https: true,
    applicationId: "4z78kzStFIRqapV8SZICm",
    certificateType: "letsencrypt",
    customCertResolver: null,
    domainType: "application",
    internalPath: "/",
    stripPath: false,
    serviceName: null,
    composeId: null,
    previewDeploymentId: null,
    customEntrypoint: null,
    middlewares: [],
  },
});

console.log(JSON.stringify(res.data?.result?.data?.json ?? res.data, null, 2));
NODE
```

The first domain was created on port `3000` for `vp preview`. After switching to static serving, I updated it to port `80`:

```bash
node --input-type=module <<'NODE'
import { createClient } from "/home/ott/.local/share/pnpm/global/v11/2e420-19eb489f949/node_modules/@dokploy/cli/dist/client.js";

const client = createClient();

const res = await client.post("/trpc/domain.update", {
  json: {
    domainId: "9eKZ5GyK6RZ-PIV34RaDv",
    host: "qr.0xott.cloud",
    path: "/",
    port: 80,
    https: true,
    certificateType: "letsencrypt",
    customCertResolver: null,
    domainType: "application",
    internalPath: "/",
    stripPath: false,
    serviceName: null,
    customEntrypoint: null,
    middlewares: [],
  },
});

console.log(JSON.stringify(res.data?.result?.data?.json ?? res.data, null, 2));
NODE
```

Deployment trigger:

```bash
dokploy application deploy \
  --applicationId 4z78kzStFIRqapV8SZICm \
  --title "Deploy QR SPA" \
  --description "Initial Nixpacks deployment from main" \
  --json

dokploy application deploy \
  --applicationId 4z78kzStFIRqapV8SZICm \
  --title "Allow qr host" \
  --description "Redeploy with Vite preview allowedHosts" \
  --json

dokploy application deploy \
  --applicationId 4z78kzStFIRqapV8SZICm \
  --title "Use static publish directory" \
  --description "Serve dist through Dokploy static publish-directory flow" \
  --json
```

Deployment status polling used `deployment.allByType` through the same API client:

```bash
node --input-type=module <<'NODE'
import { createClient } from "/home/ott/.local/share/pnpm/global/v11/2e420-19eb489f949/node_modules/@dokploy/cli/dist/client.js";

const client = createClient();
const input = encodeURIComponent(JSON.stringify({
  json: { id: "4z78kzStFIRqapV8SZICm", type: "application" },
}));
const res = await client.get(`/trpc/deployment.allByType?input=${input}`);
const deployments = res.data?.result?.data?.json ?? res.data;

console.log(JSON.stringify(deployments.slice(0, 5).map((d) => ({
  deploymentId: d.deploymentId,
  title: d.title,
  status: d.status,
  createdAt: d.createdAt,
  finishedAt: d.finishedAt,
})), null, 2));
NODE
```

Do not paste raw `application.one` output into public notes; this Dokploy API response can include GitHub provider secrets.

## Dokploy Vite Example Comparison

I cloned the Dokploy examples repo into `/tmp`:

```bash
rm -rf /tmp/dokploy-examples
git clone --depth 1 https://github.com/Dokploy/examples.git /tmp/dokploy-examples
```

Files checked:

```text
/tmp/dokploy-examples/vite/README.md
/tmp/dokploy-examples/vite/package.json
/tmp/dokploy-examples/vite/vite.config.ts
```

Their README uses Dokploy's Nixpacks publish-directory flow:

```text
Repository: https://github.com/Dokploy/examples.git
Branch: main
Build path: /vite
Publish Directory: ./dist (Nixpacks)
Generated domain port: 80
```

Their `vite.config.ts` also contains:

```ts
preview: {
  port: 3000,
  host: true,
}
```

The important difference is that the README's `Publish Directory: ./dist` plus port `80` means Dokploy serves the built static files directly. In that mode, public traffic does not go through `vite preview`, so Vite's host-header checks are not involved.

The current deployment now follows that pattern. The earlier preview-server deployment ran:

```bash
pnpm exec vp preview --host 0.0.0.0 --port 3000
```

Because public requests reached that preview server with `Host: qr.0xott.cloud`, Vite rejected the request until `qr.0xott.cloud` was added to `preview.allowedHosts`.

`--host 0.0.0.0` controls which network interface the preview server binds to. It does not mean every HTTP `Host` header is trusted.

## Validation

Local checks run:

```bash
vp install
vp check
vp build
nixpacks build . --name qr-nixpacks-local-test --no-error-without-start --no-cache
```

Public check:

```bash
curl -I https://qr.0xott.cloud
```

The final response was `HTTP/2 200`.

## Known Test Note

`vp test` currently fails before running tests because Vitest expects `jsdom`, but `jsdom` is not installed and there are no test files. This was not a deployment blocker.
