import type { NoteBlock, NotePage } from "@/types/notez";

function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>(.*?)<\/\1>/gi, "*$2*")
    .replace(/<(del|s|strike)>(.*?)<\/\1>/gi, "~~$2~~")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function plainTextFromHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function serializePageToMarkdown(page: NotePage, blocks: NoteBlock[]): string {
  const lines: string[] = [];
  lines.push(`# ${page.icon ? `${page.icon} ` : ""}${page.title || "Untitled"}`);
  lines.push("");

  let numberedIndex = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = stripHtmlTags(block.content);

    if (block.type !== "numbered") {
      numberedIndex = 1;
    }

    switch (block.type) {
      case "heading1":
        lines.push(`# ${text}`);
        lines.push("");
        break;
      case "heading2":
        lines.push(`## ${text}`);
        lines.push("");
        break;
      case "heading3":
        lines.push(`### ${text}`);
        lines.push("");
        break;
      case "todo": {
        const mark = block.props?.checked ? "x" : " ";
        lines.push(`- [${mark}] ${text}`);
        break;
      }
      case "bullet":
        lines.push(`- ${text}`);
        break;
      case "numbered":
        lines.push(`${numberedIndex}. ${text}`);
        numberedIndex++;
        break;
      case "quote":
        lines.push(`> ${text.replace(/\n/g, "\n> ")}`);
        lines.push("");
        break;
      case "callout": {
        const icon = block.props?.icon || "💡";
        lines.push(`> ${icon} **Note:** ${text.replace(/\n/g, "\n> ")}`);
        lines.push("");
        break;
      }
      case "toggle": {
        lines.push(`<details>`);
        lines.push(`<summary>${text || "Details"}</summary>`);
        lines.push("");
        if (block.props?.details) {
          lines.push(block.props.details);
          lines.push("");
        }
        lines.push(`</details>`);
        lines.push("");
        break;
      }
      case "code": {
        const lang = block.props?.language || "";
        lines.push(`\`\`\`${lang}`);
        lines.push(plainTextFromHtml(block.content));
        lines.push("```");
        lines.push("");
        break;
      }
      case "divider":
        lines.push("---");
        lines.push("");
        break;
      case "table": {
        const cols = block.props?.columns ?? [];
        const rows = block.props?.rows ?? [];
        if (cols.length > 0) {
          lines.push(`| ${cols.map((c) => c.name).join(" | ")} |`);
          lines.push(`| ${cols.map(() => "---").join(" | ")} |`);
          for (const row of rows) {
            lines.push(
              `| ${cols.map((c) => (row.cells?.[c.id] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`
            );
          }
          lines.push("");
        }
        break;
      }
      case "paragraph":
      default:
        if (text.trim()) {
          lines.push(text);
          lines.push("");
        } else {
          lines.push("");
        }
        break;
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
