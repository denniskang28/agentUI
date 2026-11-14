import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
export function zipFiles(
  files: Array<{ name: string; content: string; mode?: number }>,
) {
  return execFileSync(
    "python3",
    [
      "-c",
      `import io,json,sys,zipfile
out=io.BytesIO()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for f in json.load(sys.stdin):
  info=zipfile.ZipInfo(f['name']);info.create_system=3;info.external_attr=f.get('mode',0o100644)<<16
  z.writestr(info,f['content'])
sys.stdout.buffer.write(out.getvalue())`,
    ],
    { input: JSON.stringify(files), maxBuffer: 12_000_000 },
  );
}
export async function counterFixture(
  id: string,
  sourceTransform = (source: string) => source,
) {
  const manifest = JSON.parse(
    await readFile("examples/plugins/unknown-counter/plugin.json", "utf8"),
  );
  const catalog = JSON.parse(
    await readFile("examples/plugins/unknown-counter/catalog.json", "utf8"),
  );
  manifest.id = id;
  manifest.displayName = id;
  catalog.catalogId = `urn:enterprise:plugin:${id}`;
  const source = sourceTransform(
    (
      await readFile("examples/plugins/unknown-counter/src/index.tsx", "utf8")
    ).replace("thirdparty.counter", id),
  );
  return {
    manifest,
    catalog,
    source,
    files: [
      { name: "plugin.json", content: JSON.stringify(manifest) },
      { name: "catalog.json", content: JSON.stringify(catalog) },
      { name: "src/index.tsx", content: source },
    ],
  };
}
