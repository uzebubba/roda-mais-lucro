import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => WebSpeechRecognition;

type SpeechRecognitionResultEntry = {
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

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
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
      setListening(true);
      setError(null);
      setTranscript("");
    };
    rec.onerror = (event: SpeechRecognitionErrorLike) => {
      setError(event?.error || "speech_error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    rec.onresult = (event: SpeechRecognitionEventLike) => {
      if (!event?.results) {
        return;
      }

      const transcriptText = Array.from(event.results)
        .map((result) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();

      setTranscript(transcriptText);
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
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionCtor, supported]);

  const start = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (_error) {
      /* noop - already started */
    }
  };

  const stop = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_error) {
      /* noop */
    }
  };

  return { supported, listening, transcript, error, start, stop };
};
