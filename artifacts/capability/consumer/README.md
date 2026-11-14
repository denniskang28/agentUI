# Installed capability consumer / 能力画像安装验证

This folder contains verification source, not a second application implementation.
The consumer imports only the actual installed package's public exports.

在仓库根目录先完成 `pnpm setup:demo`，再运行：

```sh
pnpm exec playwright install chromium
pnpm capability:consumer
```

The command installs the generated tarball with `npm ci --ignore-scripts`, recreates
`batches.json` and `app.js`, starts temporary parent/Host servers, verifies actual
DOM, Actions and an update, then closes the servers. Ports 5285 and 4285 must be
free. It writes `report.json` and `installed-host.png` as evidence. The package and
Host must come from the same preparation run. No Playground server is needed.

`app.js`, `batches.json` and `node_modules` are generated locally and excluded from
Git. Package, fixture and verification source remain checked in.
