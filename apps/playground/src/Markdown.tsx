import type { ReactNode } from "react";

type Navigate = (href: string) => void;
function inline(text: string, onNavigate?: Navigate): ReactNode[] {
  return text
    .split(/(\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g)
    .map((part, i) => {
      if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
      const href = link?.[2] ?? part;
      const external = /^https?:\/\//.test(href);
      const local = /^[-\w]+\.(?:zh-CN|en-US)\.md$/.test(href);
      if (external || (link && local && onNavigate))
        return (
          <a
            key={i}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            onClick={
              external
                ? undefined
                : (event) => {
                    event.preventDefault();
                    onNavigate?.(href);
                  }
            }
          >
            {link?.[1] ?? part}
          </a>
        );
      return part;
    });
}
const isTableRule = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/** Checked-in guides only. React escapes content; no HTML, scripts or executable Markdown. */
export function Markdown({
  text,
  onNavigate,
}: {
  text: string;
  onNavigate?: Navigate;
}) {
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
    if (line.includes("|") && isTableRule(lines[i + 1] ?? "")) {
      const headers = cells(line),
        rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|"))
        rows.push(cells(lines[i++]));
      i--;
      blocks.push(
        <div className="docs-table" key={i} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, index) => (
                  <th scope="col" key={index}>
                    {inline(cell, onNavigate)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {headers.map((_, column) => (
                    <td key={column}>
                      {inline(row[column] ?? "", onNavigate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={i}>{inline(line.slice(3), onNavigate)}</h2>);
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={i}>{inline(line.slice(4), onNavigate)}</h3>);
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
          <li key={i}>
            {inline(lines[i].replace(/^(\d+\.|-) /, ""), onNavigate)}
          </li>,
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
      !/^#{1,3} |^```|^\d+\. |^- /.test(lines[i + 1]) &&
      !(lines[i + 1].includes("|") && isTableRule(lines[i + 2] ?? ""))
    )
      paragraph.push(lines[++i]);
    blocks.push(<p key={i}>{inline(paragraph.join(" "), onNavigate)}</p>);
  }
  return <>{blocks}</>;
}
