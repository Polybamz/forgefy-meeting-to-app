// ---------------------------------------------------------------------------
// Chat transcript types and persistence
// ---------------------------------------------------------------------------
// Shared by the project editor route. Kept out of the route file so the pure
// encode/decode pair can be unit-tested without mounting the page.

export interface PlanFile {
  path: string;
  purpose?: string;
  changes?: string;
}

export interface PlanDep {
  package: string;
  reason?: string;
}

export interface PlanData {
  summary: string;
  files_to_create: PlanFile[];
  files_to_modify: PlanFile[];
  dependencies: PlanDep[];
  steps: string[];
  constraints?: string[];
}

export interface LogEntry {
  type: string;
  message: string;
  ts: number;
}

/**
 * The agent activity produced by one run, frozen onto the message that owns it
 * once the run ends.
 *
 * Held in memory only. A run emits up to 200 log lines; persisting that for
 * every message would blow the localStorage quota and bloat every chat-history
 * POST, so a reload keeps the transcript but not the activity stream.
 */
export interface TurnActivity {
  logs: LogEntry[];
  plan: PlanData | null;
  writtenFiles: string[];
  startedAt: number;
  endedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  timestamp: Date;
  needsDatabase?: boolean;
  clarifyOptions?: string[];
  activity?: TurnActivity;
  /** Set once a clarify option has been chosen, so the row cannot fire twice. */
  answeredOption?: string;
  /**
   * On an error bubble: the message whose send failed, so Retry has something
   * to resend. Absent on errors that did not come from a send (a build that
   * failed on its own), where there is nothing to retry from here.
   */
  retryPrompt?: string;
}

/**
 * The wire shape for localStorage and the chat-history endpoint.
 *
 * `needsDatabase` and `clarifyOptions` are part of the contract on purpose: a
 * message can carry an unanswered question ("Add a database / No thanks"), and
 * dropping the fields strands the user on a prompt whose buttons no longer
 * exist after a reload.
 */
export interface StoredMessage {
  id: string;
  role: string;
  text: string;
  timestamp: string;
  needsDatabase?: boolean;
  clarifyOptions?: string[];
  answeredOption?: string;
}

/** How many messages either side of the wire keeps. */
export const CHAT_HISTORY_LIMIT = 100;

// ---------------------------------------------------------------------------
// Typed activity events
// ---------------------------------------------------------------------------
// The log socket carries {type, message} where message is a string. Some types
// carry JSON in that string ("plan", "todo", "findings"); "tool" carries a
// human label that usually names its subject in backticks. Parsing that back
// out is what lets the UI render a file row instead of a sentence.

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export const FINDING_SEVERITIES: FindingSeverity[] = ["critical", "high", "medium", "low"];

export interface Finding {
  severity: FindingSeverity;
  file: string;
  line: number;
  summary: string;
}

export interface FindingsReport {
  status: "clean" | "issues_found" | string;
  findings: Finding[];
  summary: string;
}

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  status: TodoStatus;
  active_form?: string;
}

/** Parse a JSON-carrying log message, returning null rather than throwing. */
export function safeJson<T>(raw: string): T | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function parseFindings(raw: string): FindingsReport | null {
  const report = safeJson<FindingsReport>(raw);
  if (!report || !Array.isArray(report.findings)) return null;
  return report;
}

export function parseTodos(raw: string): TodoItem[] | null {
  const todos = safeJson<TodoItem[]>(raw);
  return Array.isArray(todos) && todos.length > 0 ? todos : null;
}

/** Group findings worst-first. Empty severities are omitted. */
export function groupBySeverity(findings: Finding[]): Array<[FindingSeverity, Finding[]]> {
  return FINDING_SEVERITIES.map(
    (sev) => [sev, findings.filter((f) => f.severity === sev)] as [FindingSeverity, Finding[]],
  ).filter(([, list]) => list.length > 0);
}

/** What a tool call did, for the badge and the status dot. */
export type ToolAction = "create" | "edit" | "delete" | "move" | "read" | "run" | "other";

export interface ToolEvent {
  action: ToolAction;
  /** The backticked subject, when the label named one. */
  subject: string | null;
  /** True when the subject looks like a file path rather than a pattern. */
  isPath: boolean;
  /** The label with the subject removed, e.g. "1 change". */
  detail: string | null;
  /** The original label, always kept so nothing is lost. */
  label: string;
}

const TOOL_ACTIONS: Array<[RegExp, ToolAction]> = [
  [/^Creating\b/i, "create"],
  [/^Editing\b/i, "edit"],
  [/^Removing\b|^Deleting\b/i, "delete"],
  [/^Moving\b|^Renaming\b/i, "move"],
  [/^Reading\b|^Exploring\b|^Searching\b|^Finding\b|^Listing\b/i, "read"],
  [/^Running\b|^Starting\b/i, "run"],
];

/**
 * Recover structure from a tool label.
 *
 * The backend renders tool calls as prose ("Editing `lib/main.dart` · 1
 * change"). Write calls are the exception: they get a semantic label with no
 * path at all ("Domain entity [auth] · Login User"), so `subject` is null there
 * and the label carries the meaning. Callers must render the label either way —
 * never drop an event because it did not parse.
 */
export function parseToolEvent(message: string): ToolEvent {
  const label = message.trim();

  let action: ToolAction = "other";
  for (const [re, kind] of TOOL_ACTIONS) {
    if (re.test(label)) {
      action = kind;
      break;
    }
  }

  const backticked = label.match(/`([^`]+)`/);
  const subject = backticked ? backticked[1] : null;

  // A path has a separator or an extension, and no spaces. "src/app.ts" yes;
  // "useState" or "npm run build" no.
  const isPath =
    !!subject && !/\s/.test(subject) && (subject.includes("/") || /\.\w{1,8}$/.test(subject));

  let detail: string | null = null;
  if (subject) {
    const rest = label
      .replace(/`[^`]+`/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // Strip the leading verb and any leftover separator.
    detail =
      rest
        .replace(/^[A-Za-z ]+?(?=·|$)/, "")
        .replace(/^[·—-]\s*/, "")
        .trim() || null;
  }

  return { action, subject, isPath, detail, label };
}

/** How many log lines a single run keeps in memory. */
export const LOG_BUFFER_LIMIT = 200;

/**
 * Fold one incoming log event into the buffer.
 *
 * Pure so the collapsing rules can be tested directly. Two of them matter:
 * an identical line never stacks twice (repeated retry warnings are already on
 * screen), and consecutive `thinking` events replace each other rather than
 * accumulating — the agent emits a lot of them and only the latest is useful.
 */
export function appendLog(
  prev: LogEntry[],
  entry: LogEntry,
  cap: number = LOG_BUFFER_LIMIT,
): LogEntry[] {
  const sliced = prev.length > cap ? prev.slice(-cap) : prev;
  const last = sliced[sliced.length - 1];

  if (last && last.type === entry.type && last.message === entry.message) return sliced;
  if (entry.type === "thinking" && last?.type === "thinking") {
    return [...sliced.slice(0, -1), entry];
  }
  return [...sliced, entry];
}

/** Human duration for the per-turn stats line. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

// ---------------------------------------------------------------------------
// Submission policy
// ---------------------------------------------------------------------------

/** What a keyboard gesture in the composer resolves to. */
export type SubmitAction =
  /** Send immediately. */
  | "send"
  /** Hold it; the agent is busy and it goes out when the run ends. */
  | "queue"
  /** Insert a newline — let the textarea handle the key. */
  | "newline"
  /** Do nothing, and do not swallow the key. */
  | "ignore";

export interface SubmitGesture {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  /** True while an IME is converting a candidate. */
  isComposing?: boolean;
}

export interface ComposerState {
  /** The trimmed draft is non-empty. */
  hasText: boolean;
  /** A run is in flight, or a send is already on the wire. */
  busy: boolean;
}

/**
 * Resolve a composer keystroke into an action.
 *
 * Enter sends and Shift+Enter inserts a newline, which is what every chat UI
 * users know does — the previous binding fired only on Cmd/Ctrl+Enter.
 * Cmd/Ctrl+Enter keeps working so existing muscle memory is not punished.
 *
 * The `isComposing` check is load-bearing: while an IME is converting, Enter
 * confirms the candidate. Treating it as "send" fires a half-typed message on
 * the first conversion in Japanese, Chinese and Korean input.
 */
export function resolveSubmit(e: SubmitGesture, state: ComposerState): SubmitAction {
  if (e.key !== "Enter") return "ignore";
  if (e.isComposing) return "ignore";
  if (e.shiftKey) return "newline";
  if (!state.hasText) return "ignore";
  return state.busy ? "queue" : "send";
}

/**
 * Collision-free message ids.
 *
 * `Date.now()` produced duplicate React keys whenever two messages were
 * appended inside the same millisecond — exactly what happens when a request
 * fails and an error bubble lands next to the assistant reply. `randomUUID`
 * needs a secure context, hence the fallback.
 */
export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

/**
 * Project the transcript down to what is worth keeping.
 *
 * Error bubbles describe a failed request in this tab, not project history —
 * persisting them meant a one-off network blip stayed on screen forever.
 * `activity` is dropped for the reason given on TurnActivity.
 */
export function encodeMessagesForPersist(messages: ChatMessage[]): StoredMessage[] {
  return messages
    .filter((m) => m.role !== "error")
    .slice(-CHAT_HISTORY_LIMIT)
    .map((m) => {
      const out: StoredMessage = {
        id: m.id,
        role: m.role,
        text: m.text,
        timestamp: m.timestamp.toISOString(),
      };
      if (m.needsDatabase) out.needsDatabase = true;
      if (m.clarifyOptions?.length) out.clarifyOptions = m.clarifyOptions;
      if (m.answeredOption) out.answeredOption = m.answeredOption;
      return out;
    });
}

export function decodeStoredMessages(raw: StoredMessage[] | null | undefined): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    id: m.id,
    role: m.role === "user" || m.role === "error" ? m.role : "assistant",
    text: m.text ?? "",
    timestamp: new Date(m.timestamp),
    needsDatabase: m.needsDatabase || undefined,
    clarifyOptions: m.clarifyOptions?.length ? m.clarifyOptions : undefined,
    answeredOption: m.answeredOption || undefined,
  }));
}
