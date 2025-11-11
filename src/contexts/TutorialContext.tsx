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
import { useLocation } from "react-router-dom";
import { TutorialOverlay, type TutorialOverlayStep } from "@/components/tutorial/TutorialOverlay";
import { scrollElementIntoView } from "@/lib/tutorial-helpers";

const STORAGE_KEY = "roda_plus_tutorial_state_v1";

const ANCHORS = [
  "home-welcome",
  "home-register",
  "home-summary",
  "home-daily-stats",
  "home-period-toggle",
  "home-shift-control",
  "home-goal",
  "bottomnav-fuel",
  "bottomnav-historico",
  "bottomnav-fixas",
  "bottomnav-perfil",
  "help-button",
] as const;

export type TutorialAnchorId = (typeof ANCHORS)[number];

export type TutorialStep = TutorialOverlayStep & {
  anchorId: TutorialAnchorId;
};

export type TutorialTargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TutorialStatus = "never" | "completed" | "skipped";

type TutorialContextValue = {
  isOpen: boolean;
  steps: TutorialStep[];
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  openTutorial: (startStepId?: string) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  skipTutorial: () => void;
  markCompleted: () => void;
  registerAnchor: (anchorId: TutorialAnchorId, element: HTMLElement | null) => void;
  wasCompleted: boolean;
  wasSkipped: boolean;
};

const DEFAULT_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    anchorId: "home-welcome",
    title: "Bem-vindo ao Bubbapp!",
    description: "Vamos te mostrar o básico em 1 minutinho.",
  },
  {
    id: "register",
    anchorId: "home-register",
    title: "Registrar ganhos e gastos",
    description: "Use os botões Ganho/Gasto para lançar corridas ou despesas em segundos.",
  },
  {
    id: "summary",
    anchorId: "home-summary",
    title: "Resumo rápido",
    description: "Veja quanto entrou, saiu e sobrou no dia. Esses cards mostram seus números em tempo real.",
  },
  {
    id: "daily",
    anchorId: "home-daily-stats",
    title: "Meu dia completo",
    description:
      "Acompanhe viagens, tempo de volante, lucro médio e abra o histórico semanal quando quiser.",
  },
  {
    id: "period",
    anchorId: "home-period-toggle",
    title: "Escolha o período",
    description:
      "Toque em \"Hoje\" para alternar entre Semana ou Mês e ver seu faturamento do intervalo escolhido.",
  },
  {
    id: "shift",
    anchorId: "home-shift-control",
    title: "Controle o expediente",
    description:
      "Use \"Iniciar\" para começar a contar o turno e \"Finalizar\" quando encerrar. Assim seu tempo fica sempre registrado.",
  },
  {
    id: "goals",
    anchorId: "home-goal",
    title: "Metas e ajuda",
    description: "Ajuste suas metas diárias e mensais para acompanhar o progresso do dia.",
  },
  {
    id: "fuel",
    anchorId: "bottomnav-fuel",
    title: "Combustível e registros",
    description: "No atalho Combustível você registra abastecimentos e despesas rápidas quando precisar.",
    placement: "top",
  },
  {
    id: "history",
    anchorId: "bottomnav-historico",
    title: "Histórico completo",
    description: "Veja todas as corridas, despesas e filtros avançados para revisar qualquer dia.",
    placement: "top",
  },
  {
    id: "fixed",
    anchorId: "bottomnav-fixas",
    title: "Despesas fixas",
    description: "Organize contas mensais, marque como pagas e evite esquecer boletos recorrentes.",
    placement: "top",
  },
  {
    id: "profile",
    anchorId: "bottomnav-perfil",
    title: "Perfil e configurações",
    description: "Atualize dados pessoais, assinatura e preferências do app sempre que precisar.",
    placement: "top",
  },
  {
    id: "help",
    anchorId: "help-button",
    title: "Ajuda sempre à vista",
    description: "Para repetir esse passo a passo, toque nesse ícone de ajuda a qualquer momento.",
  },
];

const TutorialContext = createContext<TutorialContextValue | null>(null);

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const emitTutorialEvent = (name: string, payload: Record<string, unknown> = {}) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("tutorial:event", {
      detail: { name, ...payload },
    }),
  );
};

const now = () => {
  if (typeof window !== "undefined" && window.performance) {
    return window.performance.now();
  }
  return Date.now();
};

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [steps] = useState(DEFAULT_STEPS);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<TutorialStatus>("never");
  const [targetRect, setTargetRect] = useState<TutorialTargetRect | null>(null);
  const anchorsRef = useRef(new Map<TutorialAnchorId, HTMLElement>());
  const startTimeRef = useRef<number | null>(null);
  const hasAutostartedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "completed" || stored === "skipped") {
        setStatus(stored);
      }
    } catch {
      // Ignore storage issues
    }
  }, []);

  const persistStatus = useCallback((next: Exclude<TutorialStatus, "never">) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures
    }
  }, []);

  const updateTargetRect = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isOpen) {
      setTargetRect(null);
      return;
    }
    const step = steps[currentStepIndex];
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
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentStepIndex, isOpen, steps]);

  const registerAnchor = useCallback(
    (anchorId: TutorialAnchorId, element: HTMLElement | null) => {
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

  useClientLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    updateTargetRect();

    const handleWindowUpdate = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleWindowUpdate);
    window.addEventListener("scroll", handleWindowUpdate, true);
    return () => {
      window.removeEventListener("resize", handleWindowUpdate);
      window.removeEventListener("scroll", handleWindowUpdate, true);
    };
  }, [isOpen, updateTargetRect]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const openTutorial = useCallback(
    (startStepId?: string) => {
      setCurrentStepIndex(() => {
        if (!startStepId) {
          return 0;
        }
        const foundIndex = steps.findIndex((stepItem) => stepItem.id === startStepId);
        return foundIndex >= 0 ? foundIndex : 0;
      });
      startTimeRef.current = now();
      setIsOpen(true);
      emitTutorialEvent("tutorial_opened", {
        startStepId: startStepId ?? steps[0]?.id,
      });
    },
    [steps],
  );

  const markCompleted = useCallback(() => {
    setIsOpen(false);
    setStatus("completed");
    persistStatus("completed");
    const duration = startTimeRef.current ? Math.max(0, Math.round(now() - startTimeRef.current)) : null;
    emitTutorialEvent("tutorial_completed", {
      durationMs: duration,
    });
  }, [persistStatus]);

  const skipTutorial = useCallback(() => {
    setIsOpen(false);
    setStatus("skipped");
    persistStatus("skipped");
    const duration = startTimeRef.current ? Math.max(0, Math.round(now() - startTimeRef.current)) : null;
    emitTutorialEvent("tutorial_skipped", {
      durationMs: duration,
      stepId: steps[currentStepIndex]?.id,
    });
  }, [currentStepIndex, persistStatus, steps]);

  const goToNext = useCallback(() => {
    if (currentStepIndex + 1 >= steps.length) {
      markCompleted();
      return;
    }
    setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }, [currentStepIndex, markCompleted, steps.length]);

  const goToPrevious = useCallback(() => {
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const keyboardHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skipTutorial();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (currentStepIndex + 1 >= steps.length) {
          markCompleted();
        } else {
          goToNext();
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    };
    window.addEventListener("keydown", keyboardHandler);
    return () => {
      window.removeEventListener("keydown", keyboardHandler);
    };
  }, [currentStepIndex, goToNext, goToPrevious, isOpen, markCompleted, skipTutorial, steps.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const step = steps[currentStepIndex];
    if (!step) {
      return;
    }
    emitTutorialEvent("tutorial_step_view", {
      stepId: step.id,
      stepIndex: currentStepIndex,
    });
  }, [currentStepIndex, isOpen, steps]);

  useEffect(() => {
    if (status !== "never" || isOpen || hasAutostartedRef.current) {
      return;
    }
    if (location.pathname !== "/") {
      return;
    }
    hasAutostartedRef.current = true;
    openTutorial();
  }, [isOpen, location.pathname, openTutorial, status]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      isOpen,
      steps,
      currentStepIndex,
      currentStep: steps[currentStepIndex] ?? null,
      openTutorial,
      goToNext,
      goToPrevious,
      skipTutorial,
      markCompleted,
      registerAnchor,
      wasCompleted: status === "completed",
      wasSkipped: status === "skipped",
    }),
    [
      currentStepIndex,
      goToNext,
      goToPrevious,
      isOpen,
      markCompleted,
      openTutorial,
      registerAnchor,
      skipTutorial,
      status,
      steps,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialOverlay
        isOpen={isOpen}
        step={steps[currentStepIndex] ?? null}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        targetRect={targetRect}
        onNext={goToNext}
        onBack={goToPrevious}
        onSkip={skipTutorial}
        onComplete={markCompleted}
      />
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
};

export const useTutorialAnchor = <T extends HTMLElement = HTMLElement>(
  anchorId: TutorialAnchorId,
) => {
  const { registerAnchor } = useTutorial();
  return useCallback(
    (node: T | null) => {
      registerAnchor(anchorId, node as HTMLElement | null);
    },
    [anchorId, registerAnchor],
  );
};
