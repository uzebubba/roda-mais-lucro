import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => WebSpeechRecognition;

type SpeechRecognitionResultEntry = {
  isFinal?: boolean;
  0?: {
    transcript?: string;
  };
};

interface SpeechRecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionEventLike {
  results?: ArrayLike<SpeechRecognitionResultEntry>;
}

interface WebSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export interface SpeechState {
  supported: boolean;
  listening: boolean;
  transcript: string;
  isFinalTranscript: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

// Web Speech API hook (pt-BR), seguro para SSR
export const useSpeechRecognition = (): SpeechState => {
  const SpeechRecognitionCtor = useMemo<SpeechRecognitionConstructor | null>(() => {
    if (typeof window === "undefined") return null;
    const speechWindow = window as WindowWithSpeechRecognition;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }, []);

  const supported = Boolean(SpeechRecognitionCtor);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const manualStopRef = useRef(true);
  const restartTimeoutRef = useRef<number | null>(null);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isFinalTranscript, setIsFinalTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported || !SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    const rec = recognition;
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      setListening(true);
      setError(null);
      setTranscript("");
      setIsFinalTranscript(false);
    };
    rec.onerror = (event: SpeechRecognitionErrorLike) => {
      setError(event?.error || "speech_error");
      manualStopRef.current = true;
      setListening(false);
      setIsFinalTranscript(false);
    };
    rec.onend = () => {
      setListening(false);
      setIsFinalTranscript(false);
      if (!manualStopRef.current) {
        if (restartTimeoutRef.current !== null) {
          window.clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = window.setTimeout(() => {
          try {
            rec.start();
          } catch (_error) {
            /* noop */
          }
        }, 300);
      }
    };
    rec.onresult = (event: SpeechRecognitionEventLike) => {
      if (!event?.results) {
        return;
      }

      let finalTranscript = "";
      let interimTranscript = "";

      Array.from(event.results).forEach((result) => {
        const snippet = result?.[0]?.transcript ?? "";
        if (!snippet) {
          return;
        }
        if (result?.isFinal) {
          finalTranscript += `${snippet} `;
        } else {
          interimTranscript += `${snippet} `;
        }
      });

      const nextTranscript = (finalTranscript || interimTranscript).trim();

      if (nextTranscript.length === 0) {
        return;
      }

      setTranscript(nextTranscript);
      setIsFinalTranscript(finalTranscript.trim().length > 0);
    };

    return () => {
      try {
        rec.onstart = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onresult = null;
        rec.abort?.();
      } catch (_error) {
        /* noop */
      }
      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      manualStopRef.current = true;
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionCtor, supported]);

  const start = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      manualStopRef.current = false;
      setIsFinalTranscript(false);
      recognitionRef.current.start();
    } catch (_error) {
      const error = _error as DOMException | Error | unknown;
      let errorName: string | null = null;
      if (error instanceof DOMException) {
        errorName = error.name;
      } else if (error && typeof error === "object" && "name" in error) {
        errorName = String((error as { name?: string }).name);
      }

      manualStopRef.current = true;
      setIsFinalTranscript(false);

      switch (errorName) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          setError("not_allowed");
          break;
        case "NotFoundError":
          setError("no_microphone");
          break;
        case "AbortError":
          setError("abort_error");
          break;
        default:
          setError("speech_error");
      }
    }
  };

  const stop = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      manualStopRef.current = true;
      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      recognitionRef.current.stop();
      setIsFinalTranscript(false);
    } catch (_error) {
      /* noop */
    }
  };

  return { supported, listening, transcript, isFinalTranscript, error, start, stop };
};
