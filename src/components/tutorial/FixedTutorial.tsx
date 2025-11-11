/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TutorialOverlay, type TutorialOverlayStep } from "./TutorialOverlay";
import type { TutorialTargetRect } from "@/contexts/TutorialContext";
import { scrollElementIntoView } from "@/lib/tutorial-helpers";

const STORAGE_KEY = "bubbapp_fixed_tutorial_seen_v1";

const ANCHORS = [
  "fixas-maintenance-card",
  "fixas-maintenance-settings",
  "fixas-maintenance-register",
  "fixas-expense-card",
  "fixas-add-button",
] as const;

type FixedTutorialAnchorId = (typeof ANCHORS)[number];

type FixedTutorialStep = TutorialOverlayStep & {
  anchorId: FixedTutorialAnchorId;
};

const STEPS: FixedTutorialStep[] = [
  {
    id: "maintenance-overview",
    anchorId: "fixas-maintenance-card",
    title: "Manutenção em dia",
    description: "Veja histórico da troca de óleo e acompanhe quanto falta para a próxima revisão.",
  },
  {
    id: "maintenance-settings",
    anchorId: "fixas-maintenance-settings",
    title: "Ajuste intervalos",
    description: "Atualize o intervalo e o KM da última troca para manter os alertas sempre corretos.",
  },
  {
    id: "maintenance-register",
    anchorId: "fixas-maintenance-register",
    title: "Registre trocas",
    description: "Sempre que trocar o óleo, toque em \"Registrar troca\" para zerar o contador automaticamente.",
  },
  {
    id: "fixed-expenses",
    anchorId: "fixas-expense-card",
    title: "Despesas fixas organizadas",
    description: "Acompanhe vencimentos, valores e status de cada conta recorrente em um só lugar.",
  },
  {
    id: "add-expense",
    anchorId: "fixas-add-button",
    title: "Adicione novas contas",
    description: "Use o botão \"Adicionar\" para cadastrar uma nova despesa fixa e receber avisos de vencimento.",
  },
];

type FixedTutorialContextValue = {
  registerAnchor: (anchorId: FixedTutorialAnchorId, element: HTMLElement | null) => void;
  openTutorial: (restart?: boolean) => void;
  resetTutorial: () => void;
};

const FixedTutorialContext = createContext<FixedTutorialContextValue | null>(null);

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const FixedTutorialProvider = ({ children }: { children: ReactNode }) => {
  const readSeen = useCallback(() => {
    const storage = getStorage();
    if (!storage) {
      return false;
    }
    try {
      return storage.getItem(STORAGE_KEY) === "seen";
    } catch {
      return false;
    }
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TutorialTargetRect | null>(null);
  const anchorsRef = useRef(new Map<FixedTutorialAnchorId, HTMLElement>());
  const [hasSeen, setHasSeen] = useState(() => readSeen());
  const hasAttemptedOpenRef = useRef(false);

  const markSeen = useCallback(() => {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, "seen");
      } catch {
        // ignore
      }
    }
    setHasSeen(true);
  }, []);

  const resetSeen = useCallback(() => {
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setHasSeen(false);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }
    const step = STEPS[stepIndex];
    if (!step) {
      setTargetRect(null);
      return;
    }
    const element = anchorsRef.current.get(step.anchorId);
    if (!element) {
      setTargetRect(null);
      return;
    }
    const isCompact = window.innerWidth <= 520;
    scrollElementIntoView(element, { bottomOffset: isCompact ? 320 : 80 });
    const rect = element.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [isOpen, stepIndex]);

  useClientLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    updateTargetRect();
    const handleWindowUpdate = () => updateTargetRect();
    window.addEventListener("resize", handleWindowUpdate);
    window.addEventListener("scroll", handleWindowUpdate, true);
    return () => {
      window.removeEventListener("resize", handleWindowUpdate);
      window.removeEventListener("scroll", handleWindowUpdate, true);
    };
  }, [isOpen, updateTargetRect]);

  useEffect(() => {
    if (typeof window === "undefined" || hasSeen) {
      return;
    }
    if (hasAttemptedOpenRef.current) {
      return;
    }
    hasAttemptedOpenRef.current = true;
    const timeout = window.setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasSeen]);

  const openTutorial = useCallback((restart?: boolean) => {
    if (restart) {
      setStepIndex(0);
    }
    setIsOpen(true);
  }, []);

  const registerAnchor = useCallback(
    (anchorId: FixedTutorialAnchorId, element: HTMLElement | null) => {
      if (element) {
        anchorsRef.current.set(anchorId, element);
      } else {
        anchorsRef.current.delete(anchorId);
      }
      if (isOpen) {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => updateTargetRect());
        } else {
          updateTargetRect();
        }
      }
    },
    [isOpen, updateTargetRect],
  );

  const handleSkip = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const handleComplete = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const contextValue = useMemo<FixedTutorialContextValue>(
    () => ({
      registerAnchor,
      openTutorial,
      resetTutorial: () => {
        resetSeen();
        setStepIndex(0);
      },
    }),
    [openTutorial, registerAnchor, resetSeen],
  );

  return (
    <FixedTutorialContext.Provider value={contextValue}>
      {children}
      <TutorialOverlay
        isOpen={isOpen}
        step={STEPS[stepIndex] ?? null}
        stepIndex={stepIndex}
        totalSteps={STEPS.length}
        targetRect={targetRect}
        onNext={() => setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))}
        onBack={() => setStepIndex((index) => Math.max(index - 1, 0))}
        onSkip={handleSkip}
        onComplete={handleComplete}
      />
    </FixedTutorialContext.Provider>
  );
};

const useFixedTutorialContext = () => {
  const context = useContext(FixedTutorialContext);
  if (!context) {
    throw new Error("useFixedTutorial hook must be used within FixedTutorialProvider");
  }
  return context;
};

export const useFixedTutorialAnchor = <T extends HTMLElement = HTMLElement>(
  anchorId: FixedTutorialAnchorId,
) => {
  const { registerAnchor } = useFixedTutorialContext();
  return useCallback(
    (node: T | null) => {
      registerAnchor(anchorId, node as HTMLElement | null);
    },
    [anchorId, registerAnchor],
  );
};

export const useFixedTutorialControls = () => {
  const { openTutorial, resetTutorial } = useFixedTutorialContext();
  return {
    showTutorial: () => openTutorial(true),
    restartTutorial: () => {
      resetTutorial();
      openTutorial(true);
    },
  };
};
