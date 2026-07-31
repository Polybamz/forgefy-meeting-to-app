import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// use-voice — thin wrapper around the browser's Web Speech API for the
// assistant's voice chat: speech-to-text (SpeechRecognition) for the mic and
// text-to-speech (speechSynthesis) for spoken replies.
//
// It's entirely client-side, so there's no backend dependency. Recognition is
// only available in Chromium browsers (Chrome/Edge/Brave); everywhere else
// `sttSupported` is false and callers should hide the mic. Synthesis is far
// more widely supported.
// ---------------------------------------------------------------------------

// The Web Speech API isn't in the standard TS DOM lib, so declare the slice we
// use. Kept minimal on purpose.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Strip Markdown, then normalize the glyphs LLMs sprinkle in (arrows, dashes,
// ellipses, checkmarks, emoji). Left in, those confuse the synthesizer and it
// stops honoring the real "." "," "?" "!" — so we map them to plain words or
// pausing punctuation the engine understands.
function textForSpeech(md: string): string {
  return (
    md
      .replace(/```[\s\S]*?```/g, " code block ") // fenced code
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → link text
      .replace(/^#{1,6}\s+/gm, "") // headings
      .replace(/(\*\*|__|\*|_|~~)/g, "") // bold/italic/strike markers
      .replace(/^\s*[-*+]\s+/gm, "") // bullet markers
      .replace(/^\s*>\s?/gm, "") // block quotes
      // Glyph normalization ---------------------------------------------------
      .replace(/[•◦▪‣·]/g, "") // bullet glyphs
      .replace(/[✓✔☑]/g, "") // checkmarks
      .replace(/[→⇒➜➤↦]/g, " to ") // arrows
      .replace(/⚠️?/g, "warning: ") // warning sign
      .replace(/…/g, "... ") // ellipsis char → spoken dots
      .replace(/\s*[—–]\s*/g, ", ") // em/en dash → comma pause
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // Drop emoji / pictographs / flags / variation selectors entirely.
      .replace(/[\u{1F000}-\u{1FAFF}]/gu, "") // symbols & pictographs
      .replace(/[\u{2600}-\u{27BF}]/gu, "") // misc symbols & dingbats
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // regional indicators (flags)
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // variation selectors
      // Give sentence punctuation a trailing space if glued to the next word
      // (but not decimals like 3.5 or 1,000), so sentence splitting is reliable.
      .replace(/([!?;:])(?=\S)/g, "$1 ")
      .replace(/([.])(?=[A-Za-z])/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Break cleaned text into sentences, keeping each sentence's terminal
// punctuation. Speaking these as separate utterances forces a real pause at
// every "." "!" "?" and lets questions/exclamations keep their intonation —
// and sidesteps Chrome's long-utterance cutoff.
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

// Names of voices that are female across the common platforms (macOS/iOS,
// Windows, Android, and Chrome's cloud voices). Matched case-insensitively as
// substrings so "Google UK English Female", "Microsoft Zira", etc. all hit.
const FEMALE_VOICE_HINTS = [
  "female",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "serena",
  "allison",
  "ava",
  "susan",
  "zira",
  "hazel",
  "aria",
  "jenny",
  "sonia",
  "michelle",
  "google us english", // Chrome's default US voice reads female
  "google uk english female",
];

/** Best-effort pick of a female voice for the given language, else any match. */
function pickFemaleVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const prefix = lang.slice(0, 2).toLowerCase();
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const pool = sameLang.length ? sameLang : voices;
  const female = pool.find((v) =>
    FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint)),
  );
  return female ?? pool[0];
}

export interface VoiceChat {
  /** True when SpeechRecognition (mic → text) is available in this browser. */
  sttSupported: boolean;
  /** True when speechSynthesis (text → speech) is available. */
  ttsSupported: boolean;
  /** Mic is actively capturing. */
  listening: boolean;
  /** A reply is currently being spoken aloud. */
  speaking: boolean;
  /** Live (interim) transcript while listening; "" when idle. */
  interim: string;
  /**
   * Start capturing speech. Interim text streams to `onInterim`; the final
   * utterance is delivered to `onFinal` when the user stops talking. Cancels
   * any in-progress speech first so the mic doesn't hear the assistant.
   */
  startListening: (onFinal: (text: string) => void, onInterim?: (text: string) => void) => void;
  /** Stop capturing and emit whatever was recognized so far. */
  stopListening: () => void;
  /** Speak a (Markdown) string aloud in a female voice; `onEnd` fires when done. */
  speak: (text: string, onEnd?: () => void) => void;
  /** Stop any in-progress speech immediately. */
  cancelSpeaking: () => void;
}

export function useVoice(lang = "en-US"): VoiceChat {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Set right before we cancel speech so the final utterance's onend can tell a
  // natural finish (fire onEnd → hands-free relisten) from an interruption.
  const speakCanceledRef = useRef(false);

  const sttSupported = getRecognitionCtor() !== null;
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // The voice list loads asynchronously; grab it now and refresh on change,
  // caching the chosen female voice for `speak`.
  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => {
      voiceRef.current = pickFemaleVoice(window.speechSynthesis.getVoices(), lang);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [lang, ttsSupported]);

  const cancelSpeaking = useCallback(() => {
    speakCanceledRef.current = true;
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(
    (onFinal: (text: string) => void, onInterim?: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;

      // Don't let the assistant's own voice bleed into the mic.
      speakCanceledRef.current = true;
      if (ttsSupported) window.speechSynthesis.cancel();
      setSpeaking(false);

      // Tear down any prior instance.
      recognitionRef.current?.abort();

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      finalRef.current = "";
      onFinalRef.current = onFinal;

      rec.onresult = (e) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const chunk = result[0].transcript;
          if (result.isFinal) finalRef.current += chunk;
          else interimText += chunk;
        }
        setInterim(interimText);
        onInterim?.(interimText);
      };

      rec.onerror = () => {
        // "no-speech"/"aborted"/permission errors all just end the session;
        // onend handles cleanup.
      };

      rec.onend = () => {
        setListening(false);
        setInterim("");
        const text = finalRef.current.trim();
        finalRef.current = "";
        if (text) onFinalRef.current?.(text);
        onFinalRef.current = null;
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    },
    [lang, ttsSupported],
  );

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!ttsSupported) {
        onEnd?.();
        return;
      }
      const clean = textForSpeech(text);
      const sentences = splitSentences(clean);
      if (!sentences.length) {
        onEnd?.();
        return;
      }

      speakCanceledRef.current = false;
      window.speechSynthesis.cancel();

      // Voices may not have loaded on the very first reply; fall back to a late
      // lookup so we still get a female voice when possible.
      const chosen = voiceRef.current ?? pickFemaleVoice(window.speechSynthesis.getVoices(), lang);
      if (chosen) voiceRef.current = chosen;

      setSpeaking(true);

      // Speak one utterance per sentence: each terminal "." "!" "?" becomes a
      // real pause with its own intonation. onEnd fires only after the last one
      // finishes naturally (not when interrupted).
      sentences.forEach((sentence, i) => {
        const utter = new SpeechSynthesisUtterance(sentence);
        if (chosen) utter.voice = chosen;
        utter.lang = chosen?.lang ?? lang;
        utter.pitch = 1.1; // nudge brighter for a clearer feminine tone
        utter.rate = 1.0;
        if (i === sentences.length - 1) {
          const done = () => {
            setSpeaking(false);
            if (!speakCanceledRef.current) onEnd?.();
          };
          utter.onend = done;
          utter.onerror = done;
        }
        window.speechSynthesis.speak(utter);
      });
    },
    [lang, ttsSupported],
  );

  // Stop everything on unmount so audio doesn't outlive the widget.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    sttSupported,
    ttsSupported,
    listening,
    speaking,
    interim,
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
  };
}
