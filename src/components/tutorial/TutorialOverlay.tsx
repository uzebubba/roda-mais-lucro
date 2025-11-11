import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TutorialTargetRect } from "@/contexts/TutorialContext";

export type TutorialOverlayStep = {
  id: string;
  title: string;
  description: string;
  placement?: "top" | "bottom";
};

type TutorialOverlayProps = {
  isOpen: boolean;
  step: TutorialOverlayStep | null;
  stepIndex: number;
  totalSteps: number;
  targetRect: TutorialTargetRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const TutorialOverlay = ({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onBack,
  onSkip,
  onComplete,
}: TutorialOverlayProps) => {
  if (!isOpen || !step) {
    return null;
  }

  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const isLastStep = stepIndex === totalSteps - 1;
  const isFirstStep = stepIndex === 0;
  const primaryLabel = isFirstStep ? "Começar" : isLastStep ? "Concluir" : "Próximo";
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompact = viewportWidth <= 520;
  const padding = 16;

  const highlightStyle = targetRect
    ? {
        top: clamp(targetRect.top - padding, 12, viewportHeight - 12),
        left: clamp(targetRect.left - padding, 12, viewportWidth - 12),
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  let tooltipTop = targetRect
    ? step.placement === "top"
      ? targetRect.top - 20
      : targetRect.top + targetRect.height + 20
    : viewportHeight / 2;
  if (isCompact) {
    tooltipTop = viewportHeight - 240;
  } else {
    tooltipTop = clamp(
      tooltipTop,
      24,
      viewportHeight - 24,
    );
  }
  const tooltipLeft = clamp(
    targetRect ? targetRect.left + targetRect.width / 2 : viewportWidth / 2,
    24,
    viewportWidth - 24,
  );

  const tooltipTransform =
    isCompact
      ? "translate(-50%, 0)"
      : targetRect && step.placement === "top"
      ? "translate(-50%, -100%)"
      : targetRect
        ? "translate(-50%, 0)"
        : "translate(-50%, -50%)";

  const handlePrimaryAction = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    onNext();
  };

  const tooltipPositionStyle = isCompact
    ? {
        top: "auto",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        left: "50%",
        transform: "translate(-50%, 0)",
      }
    : {
        top: tooltipTop,
        left: tooltipLeft,
        transform: tooltipTransform,
      };

  const tooltip = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className={`pointer-events-auto fixed z-[120] ${
        isCompact
          ? "w-[calc(100%-1.25rem)] max-w-lg rounded-[28px] px-5 pb-5 pt-6"
          : "w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5"
      } border border-border/50 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-lg`}
      style={tooltipPositionStyle}
    >
      <button
        type="button"
        aria-label="Pular tutorial"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        onClick={onSkip}
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Passo {stepIndex + 1} de {totalSteps}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
      {!targetRect && (
        <p className="mt-3 text-xs text-amber-500">
          Não encontramos esse ponto agora, mas guarde essa dica.
        </p>
      )}
      <div
        className={`mt-5 flex ${
          isCompact ? "flex-col gap-3" : "flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"
        }`}
      >
        {isCompact ? (
          <>
            <div className="flex w-full gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  onClick={onBack}
                >
                  Voltar
                </Button>
              )}
              <Button className="flex-1 h-12 text-base" onClick={handlePrimaryAction}>
                {primaryLabel}
              </Button>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={onSkip}
            >
              Pular tutorial
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={onSkip}
            >
              Pular tutorial
            </button>
            <div className="flex w-full gap-2 sm:w-auto">
              {!isFirstStep && (
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={onBack}>
                  Voltar
                </Button>
              )}
              <Button className="flex-1 sm:flex-none" onClick={handlePrimaryAction}>
                {primaryLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const highlight = highlightStyle ? (
    <div
      className="pointer-events-none fixed z-[110] rounded-3xl border border-white/60 shadow-[0_0_0_9999px_rgba(7,11,20,0.75)] transition-all duration-300 ease-out"
      style={highlightStyle}
    />
  ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div className="pointer-events-auto absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
      {highlight}
      {tooltip}
    </div>,
    document.body,
  );
};
