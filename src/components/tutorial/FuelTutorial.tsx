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

const STORAGE_KEY = "bubbapp_fuel_tutorial_seen_v1";

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

const ANCHORS = [
  "fuel-card",
  "fuel-mode",
  "fuel-inputs",
  "fuel-km-card",
  "fuel-km-summary",
  "fuel-km-update",
] as const;

type FuelTutorialAnchorId = (typeof ANCHORS)[number];

type FuelTutorialStep = TutorialOverlayStep & {
  anchorId: FuelTutorialAnchorId;
};

const FUEL_STEPS: FuelTutorialStep[] = [
  {
    id: "fuel-card",
    anchorId: "fuel-card",
    title: "Registro de abastecimento",
    description:
      "Aqui você cadastra cada abastecimento e acompanha quanto está gastando no dia a dia.",
  },
  {
    id: "fuel-mode",
    anchorId: "fuel-mode",
    title: "Modo automático ou manual",
    description:
      "No automático, informe valor e preço por litro que os litros são calculados. No manual, digite a quantidade abastecida.",
  },
  {
    id: "fuel-inputs",
    anchorId: "fuel-inputs",
    title: "Campos essenciais",
    description:
      "Preencha o preço por litro, o valor total e o KM atual para manter o controle do consumo e do custo por KM.",
  },
  {
    id: "km-card",
    anchorId: "fuel-km-card",
    title: "Controle de KM rodado",
    description: "Use este bloco para atualizar a quilometragem do carro e ver como cada tanque impacta seus números.",
  },
  {
    id: "km-summary",
    anchorId: "fuel-km-summary",
    title: "Histórico e projeções",
    description: "Compare o último abastecimento com a projeção atual para saber consumo, custo e quanto já rodou desde então.",
  },
  {
    id: "km-update",
    anchorId: "fuel-km-update",
    title: "Atualize o hodômetro",
    description: "Digite o KM atual e toque em \"Atualizar KM\" para manter o histórico em dia e receber estimativas mais precisas.",
  },
];

type FuelTutorialContextValue = {
  registerAnchor: (anchorId: FuelTutorialAnchorId, element: HTMLElement | null) => void;
  openTutorial: (restart?: boolean) => void;
  resetTutorial: () => void;
};

const FuelTutorialContext = createContext<FuelTutorialContextValue | null>(null);

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const FuelTutorialProvider = ({ children }: { children: ReactNode }) => {
  const readSeen = useCallback(() => {
    const storage = getStorage();
    if (!storage) {
      return false;
    }
    try {
      return storage.getItem(STORAGE_KEY) === "seen";
    } catch (_error) {
      return false;
    }
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TutorialTargetRect | null>(null);
  const anchorsRef = useRef(new Map<FuelTutorialAnchorId, HTMLElement>());
  const hasAttemptedOpenRef = useRef(false);
  const [hasSeen, setHasSeen] = useState(() => readSeen());

  const markSeen = useCallback(() => {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, "seen");
      } catch (_error) {
        // ignore storage failure
      }
    }
    setHasSeen(true);
  }, []);

  const resetSeen = useCallback(() => {
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (_error) {
        // ignore storage failure
      }
    }
    setHasSeen(false);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }
    const step = FUEL_STEPS[stepIndex];
    if (!step) {
      setTargetRect(null);
      return;
    }
    const element = anchorsRef.current.get(step.anchorId);
    if (!element) {
      setTargetRect(null);
      return;
    }
    scrollElementIntoView(element);
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    setTargetRect({
      top: clamp(rect.top, 0, viewportHeight),
      left: clamp(rect.left, 0, viewportWidth),
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
    const seen = window.localStorage.getItem(STORAGE_KEY) === "seen";
    if (seen) {
      return;
    }
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        markSeen();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setStepIndex((index) => Math.min(index + 1, FUEL_STEPS.length - 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setStepIndex((index) =>
          index + 1 >= FUEL_STEPS.length ? index : Math.min(index + 1, FUEL_STEPS.length - 1),
        );
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [markSeen, isOpen]);

  const registerAnchor = useCallback(
    (anchorId: FuelTutorialAnchorId, element: HTMLElement | null) => {
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

  const contextValue = useMemo<FuelTutorialContextValue>(
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
    <FuelTutorialContext.Provider value={contextValue}>
      {children}
      <TutorialOverlay
        isOpen={isOpen}
        step={FUEL_STEPS[stepIndex] ?? null}
        stepIndex={stepIndex}
        totalSteps={FUEL_STEPS.length}
        targetRect={targetRect}
        onNext={() => setStepIndex((index) => Math.min(index + 1, FUEL_STEPS.length - 1))}
        onBack={() => setStepIndex((index) => Math.max(index - 1, 0))}
        onSkip={handleSkip}
        onComplete={handleComplete}
      />
    </FuelTutorialContext.Provider>
  );
};

const useFuelTutorialContextValue = () => {
  const context = useContext(FuelTutorialContext);
  if (!context) {
    throw new Error("Fuel tutorial hooks must be used within FuelTutorialProvider");
  }
  return context;
};

export const useFuelTutorialAnchor = <T extends HTMLElement = HTMLElement>(
  anchorId: FuelTutorialAnchorId,
) => {
  const { registerAnchor } = useFuelTutorialContextValue();
  return useCallback(
    (node: T | null) => {
      registerAnchor(anchorId, node as HTMLElement | null);
    },
    [anchorId, registerAnchor],
  );
};

export const useFuelTutorialControls = () => {
  const { openTutorial, resetTutorial } = useFuelTutorialContextValue();
  return {
    showTutorial: () => openTutorial(true),
    restartTutorial: () => {
      resetTutorial();
      openTutorial(true);
    },
  };
};
