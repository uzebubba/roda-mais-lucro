import { useEffect, useMemo, useRef, useState } from "react";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionCtor: any = useMemo(() => {
    if (typeof window === "undefined") return null;
    // Support webkit prefix
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }, []);

  const supported = Boolean(SpeechRecognitionCtor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    recognitionRef.current = new SpeechRecognitionCtor();
    const rec = recognitionRef.current;
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      setTranscript("");
    };
    rec.onerror = (e: any) => {
      setError(e?.error || "speech_error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    rec.onresult = (event: any) => {
      const result = event?.results?.[0]?.[0]?.transcript || "";
      setTranscript(String(result));
    };

    return () => {
      try {
        rec.onstart = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onresult = null;
        rec.abort?.();
      } catch (_e) {}
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionCtor, supported]);

  const start = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (_e) {
      // ignore already started
    }
  };

  const stop = () => {
    if (!supported || !recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_e) {}
  };

  return { supported, listening, transcript, error, start, stop };
};
