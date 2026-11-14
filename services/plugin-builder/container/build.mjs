import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const manifest = JSON.parse(await readFile("/input/plugin.json", "utf8"));
const wrapper = `import React from 'react';
import {createRoot} from 'react-dom/client';
import plugin from ${JSON.stringify("/input/" + manifest.entry)};
import {HostProvider} from '@enterprise/agent-ui-plugin-sdk';
if(plugin.id!==${JSON.stringify(manifest.id)}||plugin.version!==${JSON.stringify(manifest.version)})throw Error('Plugin export identity differs from plugin.json');
function Commit({children,node,environment}){
 const ready=React.useRef(false);
 React.useLayoutEffect(()=>{
  environment.onCommit?.();
  if(!environment.requestId)return;
  const visible=()=>node.childNodes.length>0&&node.getBoundingClientRect().height>0&&document.visibilityState==='visible';
  const report=stage=>environment.onProbe?.({requestId:environment.requestId,stage,visible:visible(),at:performance.timeOrigin+performance.now()});
  report('commit');if(!ready.current){ready.current=true;report('ready')}
  let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>report('paint'))});
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
 });return children;
}
export function mount(node,data,dispatch,environment={locale:'zh-CN'}){
 let env=environment;const root=createRoot(node,{onUncaughtError:error=>env.onError?.(String(error))});
 const render=(data,nextEnv)=>{if(nextEnv)env={...env,...nextEnv};root.render(React.createElement(HostProvider,{dispatch,locale:env.locale},React.createElement(Commit,{node,environment:env},React.createElement(plugin.Component,{data}))))};
 render(data);return{update:render,unmount:()=>root.unmount()};
}`;
const allow = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
  "zod",
]);
await build({
  stdin: { contents: wrapper, resolveDir: "/builder", loader: "tsx" },
  outfile: "/output/plugin.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: ["/builder/node_modules"],
  plugins: [
    {
      name: "dependency-policy",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.path === "@enterprise/agent-ui-plugin-sdk")
            return { path: "/builder/sdk.tsx" };
          if (
            args.importer.startsWith("/input/") &&
            !args.path.startsWith(".")
          ) {
            if (!allow.has(args.path))
              throw Error("DEPENDENCY_NOT_ALLOWED: " + args.path);
          }
          if (
            args.importer.startsWith("/input/") &&
            args.path.startsWith(".")
          ) {
            const resolved = path.resolve(
              path.dirname(args.importer),
              args.path,
            );
            if (!resolved.startsWith("/input/"))
              throw Error("PATH_OUTSIDE_PLUGIN");
          }
          if (
            args.path.startsWith("/input/") &&
            !args.path.startsWith("/input/../")
          )
            return undefined;
          return undefined;
        });
      },
    },
  ],
  logLevel: "warning",
  metafile: true,
}).then(async (result) => {
  await writeFile(
    "/output/build.json",
    JSON.stringify({
      inputs: Object.keys(result.metafile.inputs),
      bytes: result.metafile.outputs["/output/plugin.js"]?.bytes,
    }),
  );
});
