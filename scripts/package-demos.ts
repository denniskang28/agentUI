import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir("examples/dist", { recursive: true });
const result = spawnSync(
  "python3",
  [
    "-c",
    `from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
for source,name in [('risk-heatmap','finance-risk-heatmap.zip'),('expense-approval','expense-approval.zip'),('unknown-counter','unknown-counter.zip')]:
 base=Path('examples/plugins')/source
 with ZipFile(Path('examples/dist')/name,'w',ZIP_DEFLATED) as archive:
  for file in sorted(base.rglob('*')):
   if file.is_file(): archive.write(file,file.relative_to(base))
 print(name)
`,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exitCode = 1;
