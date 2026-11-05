import React from "react";

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/** Small, safe renderer for assistant prose. React escapes all user/model text. */
export function AssistantText({ text, className = "" }: { text: string; className?: string }) {
  const sections = text.split(/\n{2,}/).filter((part) => part.trim());
  return (
    <div className={`nz3-assistant-text ${className}`}>
      {sections.map((section, index) => {
        const lines = section.split("\n").filter((line) => line.trim());
        const list = /^\s*(?:[-•*]|\d+[.)])\s+/;
        if (lines.length && lines.every((line) => list.test(line))) {
          return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(list, ""))}</li>)}</ul>;
        }
        return <p key={index}>{lines.map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{inline(line)}</React.Fragment>)}</p>;
      })}
    </div>
  );
}
