import type { ReactNode } from "react";
function inline(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+|`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : part.startsWith("http") ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
/** Small, text-only renderer for our checked-in guides: no raw HTML or remote execution. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/),
    blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i]);
      blocks.push(
        <pre key={i}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.startsWith("# ")) continue; // The containing article already renders its translated title.
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={i}>{inline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={i}>{inline(line.slice(4))}</h3>);
      continue;
    }
    if (/^\d+\. /.test(line) || line.startsWith("- ")) {
      const ordered = /^\d+\. /.test(line),
        items: ReactNode[] = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\. /.test(lines[i]) : lines[i].startsWith("- "))
      ) {
        items.push(
          <li key={i}>{inline(lines[i].replace(/^(\d+\.|-) /, ""))}</li>,
        );
        i++;
      }
      i--;
      blocks.push(
        ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>,
      );
      continue;
    }
    const paragraph = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^#{1,3} |^```|^\d+\. |^- /.test(lines[i + 1])
    )
      paragraph.push(lines[++i]);
    blocks.push(<p key={i}>{inline(paragraph.join(" "))}</p>);
  }
  return <>{blocks}</>;
}
