---
name: dokploy-spa-deploy
description: Deploy static frontend SPAs to Dokploy with Nixpacks, especially Vite, Vite+, React, Solid, Vue, or similar apps. Use when Codex needs to configure Dokploy build settings, choose between static publish-directory serving and preview servers, handle Vite preview allowedHosts issues, write nixpacks.toml for an SPA, update Dokploy domains/ports, trigger deployments, or document/verify a Dokploy deployment.
---

# Dokploy SPA Deploy

## Default Strategy

Prefer Dokploy's static publish-directory flow for SPAs:

- Build the app with Nixpacks.
- Publish the built output directory, usually `./dist`.
- Enable Static SPA serving when client-side routing should fall back to `index.html`.
- Route the Dokploy domain to internal port `80`.
- Do not run `vite preview`, `vp preview`, or another preview server as the production process unless the user explicitly needs a server process.

Vite preview servers are for local previewing of production builds. If public traffic reaches Vite preview directly, Vite may reject requests by host header. `preview.allowedHosts` is only a workaround for intentionally exposing Vite preview; it is usually unnecessary and should be removed once Dokploy serves static files.

## Workflow

1. Inspect the app before changing deployment files.
   - Read `package.json`, lockfiles, existing `nixpacks.toml`, Vite/Vite+ config, and docs such as `AGENTS.md`.
   - Identify package manager, build command, output directory, required Node version, and whether client-side routing needs SPA fallback.
   - For Vite+, use `vp` commands from project docs. Typical checks are `vp install`, `vp check`, `vp build`, and `vp test` when configured.

2. Configure Nixpacks for build-only static output.
   - Keep install/build phases explicit when defaults choose the wrong Node/package-manager versions.
   - Do not add a `[start]` phase for static publish-directory deployments.
   - If Nixpacks complains about no start command during local validation, use `--no-error-without-start`.

Example `nixpacks.toml` shape:

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
dependsOn = ["setup"]
cmds = ["pnpm install --frozen-lockfile"]
cacheDirectories = ["/root/.local/share/pnpm/store"]

[phases.build]
dependsOn = ["install"]
cmds = ["pnpm build"]
cacheDirectories = ["node_modules/.cache"]
```

Adapt the Node bootstrap if the pinned Nixpacks image has an older Node than the package manager requires. For example, a project using `pnpm@11` may need Node `22.13+`; if `nodejs_22` resolves older, install a newer Node inside the install phase before installing pnpm.

3. Validate locally.

```bash
vp install
vp check
vp build
nixpacks plan .
nixpacks build . --name <app>-nixpacks-static-local-test --no-error-without-start --no-cache
```

Use the repo's actual commands when it is not a Vite+ project. Run `vp test`, `pnpm test`, or the local test command when available; if it fails because the repo has no tests or a missing test-only dependency, record that separately from deployment validation.

4. Commit and push before deploying.

```bash
git status --short --branch
git add <deployment-files>
git commit -m "Use Dokploy static publish directory"
git push origin <branch>
```

5. Configure Dokploy.
   - Build type: `nixpacks`.
   - Publish directory: `./dist` or the app's real build output.
   - Static SPA: enabled for client-side routed SPAs.
   - Domain: HTTPS enabled, internal port `80`, path `/`, internal path `/`.

The Dokploy CLI can be enough, but some commands may omit required `false` booleans or nullable fields. When using the CLI's API client directly, print only filtered fields. Raw `application.one` responses can include GitHub provider secrets.

Minimal direct API shapes:

```js
await client.post("/trpc/application.saveBuildType", { json: {
  applicationId,
  buildType: "nixpacks",
  dockerfile: null,
  dockerContextPath: null,
  dockerBuildStage: null,
  herokuVersion: null,
  railpackVersion: null,
  publishDirectory: "./dist",
  isStaticSpa: true,
}});
```

```js
await client.post("/trpc/domain.update", { json: {
  domainId,
  host,
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
}});
```

6. Trigger and poll deployment.

```bash
dokploy application deploy \
  --applicationId <application-id> \
  --title "Use static publish directory" \
  --description "Serve dist through Dokploy static publish-directory flow" \
  --json
```

Poll deployments until the latest relevant deployment reaches a terminal status. Treat `done` as success; treat `error`, `failed`, or `cancelled` as blockers and inspect logs.

7. Verify the public app.

```bash
curl -I --max-time 30 https://<host>
curl -L --max-time 30 -sS https://<host> | sed -n '1,80p'
curl -I --max-time 30 https://<host>/<built-asset-path>
curl -I --max-time 30 https://<host>/some/deep/link
```

Expected result:

- App URL returns `200`.
- Response server is Dokploy's static server such as NGINX, not Vite preview.
- Built JS/CSS assets return `200`.
- Deep SPA routes return `200` with HTML when Static SPA fallback is enabled.

## Allowed Hosts Rule

Use `preview.allowedHosts` only when running Vite preview behind Dokploy:

- `--host 0.0.0.0` controls which network interface the preview server binds to.
- `preview.allowedHosts` controls which HTTP `Host` headers Vite accepts.
- A public Dokploy domain sends a host header like `qr.example.com`, so Vite preview can reject it unless allowed.

For static publish-directory deployments, public requests do not reach Vite preview. Remove preview-only host allowlists and route the domain to port `80`.

## Documentation Notes

When asked to document the deployment, include:

- Public URL, Dokploy project/app names, Git repo/branch.
- Build type, publish directory, Static SPA setting, domain port.
- Relevant Git commands and Dokploy commands/API payloads used.
- Local validation commands and public verification results.
- Any known non-deployment test failures.
- A warning not to paste raw Dokploy app/provider objects if they may contain secrets.
