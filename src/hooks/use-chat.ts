import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, type Project } from "@/lib/api";
import {
  decodeStoredMessages,
  encodeMessagesForPersist,
  newId,
  resolveSubmit,
  type ChatMessage,
  type StoredMessage,
} from "@/lib/chat";
import type { AgentActivity } from "@/hooks/use-agent-activity";

// How close to the bottom still counts as "following along".
const SCROLL_PIN_SLACK_PX = 80;

const COMPOSER_MAX_HEIGHT_PX = 200;

/** A message the user sent while the agent was busy, waiting to go out. */
export interface QueuedMessage {
  id: string;
  text: string;
}

interface UseChatOptions {
  projectId: string;
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  activity: AgentActivity;
  /**
   * Owned by the page, because the projects socket reads it too. Set here when
   * a send queues an update so the socket does not miss the leading edge.
   */
  prevUpdatingRef: React.RefObject<boolean>;
}

/**
 * The chat transcript: messages, sending, the follow-up queue, persistence,
 * and the scroll behaviour that depends on all of them.
 */
export function useChat({
  projectId,
  project,
  setProject,
  activity,
  prevUpdatingRef,
}: UseChatOptions) {
  const chatStorageKey = `forgefy_chat_${projectId}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (raw) return decodeStoredMessages(JSON.parse(raw) as StoredMessage[]);
    } catch {
      /* ignore */
    }
    return [];
  });
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [stopping, setStopping] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainingRef = useRef(false);
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { startRun, setRunOwner } = activity;

  // ── Scroll ────────────────────────────────────────────────────────────────
  // Auto-scroll only while the user is actually at the bottom. Log ticks arrive
  // several per second, and scrolling up to re-read the plan was impossible
  // while every one of them yanked the view back down.
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [hasUnseenActivity, setHasUnseenActivity] = useState(false);
  const pinnedRef = useRef(true);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_PIN_SLACK_PX;
    pinnedRef.current = atBottom;
    setPinnedToBottom(atBottom);
    if (atBottom) setHasUnseenActivity(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    setHasUnseenActivity(false);
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setHasUnseenActivity(true);
    }
  }, [messages, activity.logs]);

  // ── Persistence ───────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(`/api/v1/projects/${projectId}/chat-history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages: StoredMessage[] } | null) => {
        if (data?.messages?.length) {
          setMessages(decodeStoredMessages(data.messages));
          localStorage.setItem(chatStorageKey, JSON.stringify(data.messages));
        }
      })
      .catch(() => {
        /* keep localStorage version */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(encodeMessagesForPersist(messages)));
    } catch {
      /* ignore quota errors */
    }
  }, [messages, chatStorageKey]);

  useEffect(() => {
    const payload = encodeMessagesForPersist(messages);
    if (payload.length === 0) return;
    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      apiFetch(`/api/v1/projects/${projectId}/chat-history`, {
        method: "POST",
        body: JSON.stringify({ messages: payload }),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    };
  }, [messages, projectId]);

  // ── Sending ───────────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    if (!text || sending || project?.is_updating) return;

    setSending(true);

    const userMsg: ChatMessage = {
      id: newId("user"),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    // Provisional owner: if this turn queues a build, the assistant reply takes
    // over below. If it does not, the user message keeps the activity.
    startRun(userMsg.id);

    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const errText = (d as { detail?: string }).detail ?? "Request failed.";
        setMessages((prev) => [
          ...prev,
          {
            id: newId("err"),
            role: "error",
            text: errText,
            timestamp: new Date(),
            retryPrompt: text,
          },
        ]);
        startRun(null);
      } else {
        const data = (await res.json()) as {
          type: string;
          response: string;
          update_queued: boolean;
          needs_database?: boolean;
          clarify_options?: string[] | null;
        };
        const assistantId = newId("assistant");
        if (data.response) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              text: data.response,
              timestamp: new Date(),
              needsDatabase: data.needs_database,
              clarifyOptions: data.clarify_options ?? undefined,
            },
          ]);
        }
        if (data.update_queued) {
          // The agent reply is what the run belongs to — hand ownership over.
          setRunOwner(data.response ? assistantId : userMsg.id);
          setProject((prev) => (prev ? { ...prev, is_updating: true, build_error: null } : prev));
          prevUpdatingRef.current = true;
        } else {
          // Nothing queued — this turn owns no activity.
          startRun(null);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newId("err"),
          role: "error",
          text: "Network error. Please try again.",
          timestamp: new Date(),
          retryPrompt: text,
        },
      ]);
      startRun(null);
    } finally {
      setSending(false);
    }
  }

  // A build takes 1–3 minutes. Rather than refusing the message, hold it and
  // send it the moment the agent frees up — the user gets to keep typing and
  // the follow-up is not lost to a dead input.
  function handleSend() {
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (sending || project?.is_updating || queue.length > 0) {
      setQueue((q) => [...q, { id: newId("queued"), text }]);
      return;
    }
    sendMessage(text);
  }

  function cancelQueued(id: string) {
    setQueue((q) => q.filter((m) => m.id !== id));
  }

  const clearQueue = useCallback(() => setQueue([]), []);

  async function handleStop() {
    if (stopping) return;
    setStopping(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/stop`, { method: "POST" });
      setProject((prev) => (prev ? { ...prev, is_updating: false } : prev));
    } catch {
      // swallow
    } finally {
      setStopping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const action = resolveSubmit(
      {
        key: e.key,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        isComposing: e.nativeEvent.isComposing,
      },
      { hasText: prompt.trim().length > 0, busy: sending || !!project?.is_updating },
    );
    // "newline" and "ignore" both mean: let the textarea have the key.
    if (action !== "send" && action !== "queue") return;
    e.preventDefault();
    handleSend();
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }

  // ── Bubble callbacks ──────────────────────────────────────────────────────
  // Stable identities, so React.memo on ChatBubble is not defeated by a fresh
  // closure on every render. sendMessage is redeclared each render, so it is
  // reached through a ref.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const handleDeclineDatabase = useCallback(() => {
    sendMessageRef.current("No, continue without a database for now.");
  }, []);

  const handleRetry = useCallback((text: string) => {
    sendMessageRef.current(text);
  }, []);

  // Edit-and-resend puts the text back in the composer rather than sending it
  // blind — the point of editing is to change it first.
  const handleEditMessage = useCallback((text: string) => {
    setPrompt(text);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
      el.setSelectionRange(text.length, text.length);
    }
  }, []);

  const handleSelectOption = useCallback((messageId: string, option: string) => {
    // Record the choice before sending so the row locks immediately, not after
    // the round trip.
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, answeredOption: option } : m)),
    );
    sendMessageRef.current(option);
  }, []);

  // ── Queue drain ───────────────────────────────────────────────────────────
  // One message at a time, in order, as soon as the agent is free. `draining`
  // covers the window between dispatching and `sending` actually flipping, so a
  // single message cannot go out twice.
  useEffect(() => {
    if (queue.length === 0) {
      drainingRef.current = false;
      return;
    }
    if (sending || project?.is_updating || drainingRef.current) return;

    drainingRef.current = true;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    Promise.resolve(sendMessage(next.text)).finally(() => {
      drainingRef.current = false;
    });
    // sendMessage is redeclared every render; drainingRef is what keeps this
    // from re-firing, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, sending, project?.is_updating]);

  // Only the newest user message offers edit-and-resend; editing an older one
  // would rewrite history the agent has already acted on.
  const lastUserMessageId = messages.reduce<string | null>(
    (found, m) => (m.role === "user" ? m.id : found),
    null,
  );

  return {
    messages,
    setMessages,
    prompt,
    setPrompt,
    sending,
    stopping,
    queue,
    lastUserMessageId,
    pinnedToBottom,
    hasUnseenActivity,
    textareaRef,
    chatEndRef,
    chatScrollRef,
    sendMessage,
    handleSend,
    handleStop,
    handleKeyDown,
    autoResize,
    cancelQueued,
    clearQueue,
    handleChatScroll,
    scrollToBottom,
    handleDeclineDatabase,
    handleRetry,
    handleEditMessage,
    handleSelectOption,
  };
}
