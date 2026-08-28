import { describe, expect, it } from "vitest";
import {
  decodeStoredMessages,
  encodeMessagesForPersist,
  newId,
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
