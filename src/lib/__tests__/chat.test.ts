import { describe, expect, it } from "vitest";
import {
  decodeStoredMessages,
  encodeMessagesForPersist,
  formatDuration,
  groupBySeverity,
  newId,
  parseFindings,
  parseTodos,
  parseToolEvent,
  resolveSubmit,
  type ChatMessage,
  type StoredMessage,
} from "@/lib/chat";

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    role: "assistant",
    text: "hello",
    timestamp: new Date("2026-01-02T03:04:05.000Z"),
    ...over,
  };
}

describe("newId", () => {
  it("does not collide inside a single millisecond", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId("assistant")));
    expect(ids.size).toBe(500);
  });

  it("keeps the prefix", () => {
    expect(newId("err").startsWith("err-")).toBe(true);
  });
});

describe("encodeMessagesForPersist", () => {
  it("keeps the action-button fields so a reload can still render them", () => {
    const [stored] = encodeMessagesForPersist([msg({ needsDatabase: true })]);
    expect(stored.needsDatabase).toBe(true);

    const [clarify] = encodeMessagesForPersist([msg({ clarifyOptions: ["Yes", "No"] })]);
    expect(clarify.clarifyOptions).toEqual(["Yes", "No"]);
  });

  it("records which option was chosen", () => {
    const [stored] = encodeMessagesForPersist([
      msg({ clarifyOptions: ["Yes", "No"], answeredOption: "Yes" }),
    ]);
    expect(stored.answeredOption).toBe("Yes");
  });

  it("drops error bubbles — they describe this tab, not project history", () => {
    const out = encodeMessagesForPersist([
      msg({ id: "a" }),
      msg({ id: "b", role: "error", text: "Network error." }),
      msg({ id: "c", role: "user" }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("omits absent optional fields rather than writing nulls", () => {
    const [stored] = encodeMessagesForPersist([msg()]);
    expect(Object.keys(stored).sort()).toEqual(["id", "role", "text", "timestamp"]);
  });

  it("serialises the timestamp as ISO 8601", () => {
    const [stored] = encodeMessagesForPersist([msg()]);
    expect(stored.timestamp).toBe("2026-01-02T03:04:05.000Z");
  });

  it("caps the payload at the last 100 messages", () => {
    const many = Array.from({ length: 140 }, (_, i) => msg({ id: `m${i}` }));
    const out = encodeMessagesForPersist(many);
    expect(out).toHaveLength(100);
    expect(out[0].id).toBe("m40");
    expect(out[99].id).toBe("m139");
  });

  it("caps AFTER filtering, so errors do not eat the budget", () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      msg({ id: `m${i}`, role: i % 2 === 0 ? "error" : "assistant" }),
    );
    expect(encodeMessagesForPersist(many)).toHaveLength(60);
  });

  it("never persists the activity stream", () => {
    const [stored] = encodeMessagesForPersist([
      msg({
        activity: {
          logs: [{ type: "tool", message: "Editing `a.ts`", ts: 1 }],
          plan: null,
          writtenFiles: ["a.ts"],
          startedAt: 0,
          endedAt: 1,
        },
      }),
    ]);
    expect(stored).not.toHaveProperty("activity");
  });
});

describe("parseToolEvent", () => {
  // The strings below are the real formats produced by
  // forgefy-backend/app/build/build_logger.py::tool_message.
  it("pulls the path and action out of an edit label", () => {
    const e = parseToolEvent("Editing `lib/screens/settings_screen.dart` · 1 change");
    expect(e.action).toBe("edit");
    expect(e.subject).toBe("lib/screens/settings_screen.dart");
    expect(e.isPath).toBe(true);
    expect(e.detail).toBe("1 change");
  });

  it("classifies the read-only verbs", () => {
    expect(parseToolEvent("Reading `lib/main.dart`").action).toBe("read");
    expect(parseToolEvent("Exploring `lib/widgets/`").action).toBe("read");
    expect(parseToolEvent("Finding files matching `**/*.dart`").action).toBe("read");
    expect(parseToolEvent("Searching for `ThemeMode` in the project").action).toBe("read");
  });

  it("classifies the mutating verbs", () => {
    expect(parseToolEvent("Creating folder `lib/theme/`").action).toBe("create");
    expect(parseToolEvent("Removing `lib/old.dart`").action).toBe("delete");
    expect(parseToolEvent("Moving `a/b.dart` → `c/d.dart`").action).toBe("move");
    expect(parseToolEvent("Running `flutter analyze`").action).toBe("run");
  });

  it("does not mistake a search pattern for a file path", () => {
    expect(parseToolEvent("Searching for `ThemeMode` in the project").isPath).toBe(false);
    expect(parseToolEvent("Running `flutter analyze`").isPath).toBe(false);
  });

  it("keeps the whole label when a write call names no path", () => {
    // write_file gets a semantic label with no backticks at all.
    const e = parseToolEvent("Domain entity [auth] · Login User");
    expect(e.subject).toBeNull();
    expect(e.label).toBe("Domain entity [auth] · Login User");
  });

  it("never returns null — an unparsed event still renders", () => {
    for (const s of ["", "   ", "something entirely new"]) {
      const e = parseToolEvent(s);
      expect(e).not.toBeNull();
      expect(e.label).toBe(s.trim());
    }
  });
});

describe("parseFindings / groupBySeverity", () => {
  const report = {
    status: "issues_found",
    summary: "Two problems.",
    findings: [
      { severity: "low" as const, file: "a.dart", line: 3, summary: "Unused import" },
      { severity: "critical" as const, file: "b.dart", line: 0, summary: "Null deref" },
      { severity: "low" as const, file: "c.dart", line: 9, summary: "Dead code" },
    ],
  };

  it("parses a findings payload", () => {
    expect(parseFindings(JSON.stringify(report))?.findings).toHaveLength(3);
  });

  it("returns null on malformed JSON rather than throwing", () => {
    expect(parseFindings("not json")).toBeNull();
    expect(parseFindings("{}")).toBeNull();
    expect(parseFindings(JSON.stringify({ findings: "nope" }))).toBeNull();
  });

  it("groups worst-first and omits empty severities", () => {
    const groups = groupBySeverity(report.findings);
    expect(groups.map(([sev, list]) => [sev, list.length])).toEqual([
      ["critical", 1],
      ["low", 2],
    ]);
  });

  it("returns no groups for a clean report", () => {
    expect(groupBySeverity([])).toEqual([]);
  });
});

describe("parseTodos", () => {
  it("parses the todo payload the backend already emits", () => {
    const todos = parseTodos(
      JSON.stringify([
        { content: "Write the controller", status: "completed", active_form: "Writing" },
        { content: "Wire it up", status: "in_progress", active_form: "Wiring it up" },
      ]),
    );
    expect(todos).toHaveLength(2);
    expect(todos?.[1].status).toBe("in_progress");
  });

  it("returns null on anything else", () => {
    expect(parseTodos("[]")).toBeNull();
    expect(parseTodos("nope")).toBeNull();
    expect(parseTodos(JSON.stringify({ a: 1 }))).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats sub-minute runs in seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("formats longer runs in minutes and seconds", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(95_000)).toBe("1m 35s");
    expect(formatDuration(3_600_000)).toBe("60m");
  });

  it("does not render nonsense for a missing timestamp", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
  });
});

describe("resolveSubmit", () => {
  const idle = { hasText: true, busy: false };
  const busy = { hasText: true, busy: true };

  it("sends on a bare Enter", () => {
    expect(resolveSubmit({ key: "Enter" }, idle)).toBe("send");
  });

  it("inserts a newline on Shift+Enter", () => {
    expect(resolveSubmit({ key: "Enter", shiftKey: true }, idle)).toBe("newline");
  });

  it("queues instead of sending while the agent is busy", () => {
    expect(resolveSubmit({ key: "Enter" }, busy)).toBe("queue");
  });

  it("still inserts a newline on Shift+Enter while busy", () => {
    expect(resolveSubmit({ key: "Enter", shiftKey: true }, busy)).toBe("newline");
  });

  it("ignores Enter that is confirming an IME candidate", () => {
    // The regression this guards: without it, the first conversion in
    // Japanese/Chinese/Korean input sends a half-typed message.
    expect(resolveSubmit({ key: "Enter", isComposing: true }, idle)).toBe("ignore");
    expect(resolveSubmit({ key: "Enter", isComposing: true }, busy)).toBe("ignore");
  });

  it("prefers the IME guard over Shift", () => {
    expect(resolveSubmit({ key: "Enter", isComposing: true, shiftKey: true }, idle)).toBe("ignore");
  });

  it("keeps Cmd/Ctrl+Enter working for existing muscle memory", () => {
    expect(resolveSubmit({ key: "Enter", metaKey: true }, idle)).toBe("send");
    expect(resolveSubmit({ key: "Enter", ctrlKey: true }, idle)).toBe("send");
    expect(resolveSubmit({ key: "Enter", metaKey: true }, busy)).toBe("queue");
  });

  it("ignores Enter on an empty draft", () => {
    expect(resolveSubmit({ key: "Enter" }, { hasText: false, busy: false })).toBe("ignore");
    expect(resolveSubmit({ key: "Enter" }, { hasText: false, busy: true })).toBe("ignore");
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Escape", "Tab", "ArrowUp", " "]) {
      expect(resolveSubmit({ key }, idle)).toBe("ignore");
    }
  });
});

describe("decodeStoredMessages", () => {
  it("round-trips the action-button fields", () => {
    const original = [
      msg({ id: "a", needsDatabase: true }),
      msg({ id: "b", clarifyOptions: ["Yes", "No"], answeredOption: "No" }),
    ];
    const back = decodeStoredMessages(encodeMessagesForPersist(original));

    expect(back[0].needsDatabase).toBe(true);
    expect(back[1].clarifyOptions).toEqual(["Yes", "No"]);
    expect(back[1].answeredOption).toBe("No");
    expect(back[0].timestamp).toBeInstanceOf(Date);
    expect(back[0].timestamp.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("tolerates a malformed or missing payload", () => {
    expect(decodeStoredMessages(null)).toEqual([]);
    expect(decodeStoredMessages(undefined)).toEqual([]);
    expect(decodeStoredMessages({} as unknown as StoredMessage[])).toEqual([]);
  });

  it("normalises an unknown role to assistant", () => {
    const [out] = decodeStoredMessages([
      { id: "x", role: "system", text: "hi", timestamp: "2026-01-02T03:04:05.000Z" },
    ]);
    expect(out.role).toBe("assistant");
  });

  it("leaves absent optionals undefined rather than false/empty", () => {
    const [out] = decodeStoredMessages([
      { id: "x", role: "user", text: "hi", timestamp: "2026-01-02T03:04:05.000Z" },
    ]);
    expect(out.needsDatabase).toBeUndefined();
    expect(out.clarifyOptions).toBeUndefined();
  });
});
