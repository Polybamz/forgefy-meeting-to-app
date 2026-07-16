import { useMemo } from "react";

/**
 * Lightweight, dependency-free syntax highlighting for doc code blocks.
 *
 * One tokenizer covers every language we show (bash, Python, JS, Go, PHP,
 * Swift, Kotlin, Dart, JSON): comments, strings, numbers, and a shared
 * keyword set. That's deliberately not a full grammar — for short snippets
 * the 80% coloring reads as well as Prism would, with zero bundle cost and
 * no SSR setup. Colors lean on theme tokens (text-accent/text-text-muted)
 * plus two mid-lightness oklch values that stay readable in light and dark.
 */

// Alternatives, in priority order:
//  1. comments   — /* … */, // (not preceded by ':' so https:// stays plain), # …
//  2. strings    — double, single, and backtick quoted, single-line, \-escapes
//  3. numbers    — ints and decimals, not inside identifiers
//  4. words      — identifiers, colored only when in KEYWORDS
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*|(?<![\w$&])#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|((?<![\w.])\d+(?:\.\d+)?(?!\w))|([A-Za-z_$][\w$]*)/g;

const KEYWORDS = new Set([
  // shared / imports
  "import",
  "from",
  "package",
  "use",
  "as",
  "in",
  "of",
  // declarations
  "const",
  "let",
  "var",
  "val",
  "func",
  "function",
  "def",
  "struct",
  "class",
  "interface",
  "type",
  "final",
  "void",
  "public",
  "private",
  "static",
  // control flow
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "until",
  "return",
  "throw",
  "throws",
  "try",
  "catch",
  "guard",
  "defer",
  "check",
  "range",
  "switch",
  "case",
  "break",
  "continue",
  // async
  "async",
  "await",
  "new",
  "this",
  "self",
  // literals
  "true",
  "false",
  "null",
  "nil",
  "None",
  "True",
  "False",
  "undefined",
  // frequent builtins in our snippets
  "print",
  "println",
  "echo",
  "main",
  "any",
  "string",
  "int",
  "map",
  "apply",
]);

const CLS = {
  comment: "text-text-muted italic",
  string: "text-[oklch(0.56_0.12_150)]", // green
  number: "text-[oklch(0.58_0.14_260)]", // blue
  keyword: "text-accent",
} as const;

function highlight(code: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;

  for (let m = TOKEN_RE.exec(code); m !== null; m = TOKEN_RE.exec(code)) {
    if (m.index > last) nodes.push(code.slice(last, m.index));
    const text = m[0];

    let cls: string | null = null;
    if (m[1]) cls = CLS.comment;
    else if (m[2]) cls = CLS.string;
    else if (m[3]) cls = CLS.number;
    else if (m[4] && KEYWORDS.has(m[4])) cls = CLS.keyword;

    nodes.push(
      cls ? (
        <span key={key++} className={cls}>
          {text}
        </span>
      ) : (
        text
      ),
    );
    last = m.index + text.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export function HighlightedCode({ code }: { code: string }) {
  const nodes = useMemo(() => highlight(code), [code]);
  return <>{nodes}</>;
}
