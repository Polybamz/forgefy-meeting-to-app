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
