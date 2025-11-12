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
  const isWelcomeStep = step.id === "welcome";
  const primaryLabel = isFirstStep ? "Começar" : isLastStep ? "Concluir" : "Próximo";
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompact = viewportWidth <= 520;
  const highlightPadding = isWelcomeStep ? (isCompact ? 8 : 12) : 16;

  const highlightStyle = targetRect
    ? (() => {
        const maxHorizontalMargin = isWelcomeStep ? 24 : 16;
        const highlightWidth = Math.min(
          targetRect.width + highlightPadding * 2,
          viewportWidth - maxHorizontalMargin,
        );
        const highlightHeight = targetRect.height + highlightPadding * 2;
        const maxLeft = Math.max(8, viewportWidth - highlightWidth - 8);
        const maxTop = Math.max(8, viewportHeight - highlightHeight - 8);
        const baseLeft = isWelcomeStep
          ? targetRect.left + targetRect.width / 2 - highlightWidth / 2
          : targetRect.left - highlightPadding;
        return {
          top: clamp(targetRect.top - highlightPadding, 8, maxTop),
          left: clamp(baseLeft, 8, maxLeft),
          width: highlightWidth,
          height: highlightHeight,
        };
      })()
    : null;

  // Para elementos na barra inferior (placement: "top"), mostrar tooltip acima
  const isBottomNavElement = step.placement === "top" && targetRect && targetRect.top > viewportHeight * 0.75;
  
  const tooltipPositionStyle = isCompact
    ? isBottomNavElement
      ? {
          position: "fixed" as const,
          bottom: `${viewportHeight - targetRect!.top + 20}px`,
          left: "50%",
          transform: "translateX(-50%)",
          maxHeight: "60vh",
        }
      : {
          position: "fixed" as const,
          bottom: "0",
          left: "0",
          right: "0",
          transform: "none",
          borderRadius: "24px 24px 0 0",
          maxHeight: "70vh",
        }
    : targetRect
    ? {
        position: "fixed" as const,
        top: step.placement === "top" 
          ? `${clamp(targetRect.top - 180, 60, viewportHeight - 200)}px`
          : `${clamp(targetRect.top + targetRect.height + 20, 60, viewportHeight - 200)}px`,
        left: "50%",
        transform: "translateX(-50%)",
      }
    : {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  const handlePrimaryAction = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    onNext();
  };

  const tooltip = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className={`pointer-events-auto z-[120] ${
        isCompact
          ? isBottomNavElement
            ? "w-[calc(100%-2rem)] max-w-md mx-auto rounded-2xl p-5 border border-border"
            : "w-full px-6 pb-8 pt-6 safe-area-inset-bottom border-t border-border"
          : "w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 border border-border"
      } bg-card text-card-foreground shadow-2xl`}
      style={tooltipPositionStyle}
    >
      {isCompact && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <span className="inline-flex h-1 w-12 rounded-full bg-border" />
        </div>
      )}
      
      <div className={isCompact ? "space-y-4" : "space-y-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {stepIndex + 1}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              de {totalSteps}
            </span>
          </div>
          <button
            type="button"
            aria-label="Pular tutorial"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-muted">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-full flex-1 transition-all duration-300 ${
                i <= stepIndex ? "bg-primary" : "bg-transparent"
              }`}
            />
          ))}
        </div>

        <div className={isCompact ? "space-y-3" : "space-y-2"}>
          <h2 className="text-lg font-semibold leading-tight text-foreground">{step.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          {!targetRect && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-500">
              <span className="mt-0.5">ℹ️</span>
              <span>Elemento não visível no momento, mas guarde essa dica.</span>
            </div>
          )}
        </div>
      </div>
      <div className={`flex gap-2 ${isCompact ? "mt-6" : "mt-4"}`}>
        {!isFirstStep && (
          <Button
            variant="outline"
            size={isCompact ? "lg" : "default"}
            className={isCompact ? "h-12 flex-1 text-base font-medium" : "flex-1"}
            onClick={onBack}
          >
            Voltar
          </Button>
        )}
        <Button
          size={isCompact ? "lg" : "default"}
          className={`${isCompact ? "h-12 text-base font-medium" : ""} ${isFirstStep ? "w-full" : "flex-1"}`}
          onClick={handlePrimaryAction}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );

  const highlight = highlightStyle ? (
    <div
      className="pointer-events-none fixed z-[110] rounded-2xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.85),0_0_0_2px_rgba(var(--primary),0.5)] transition-all duration-300 ease-out"
      style={highlightStyle}
      aria-hidden="true"
    />
  ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div 
        className="pointer-events-auto absolute inset-0 bg-black/75 transition-opacity duration-300" 
        onClick={onSkip}
        aria-hidden="true"
      />
      {highlight}
      {tooltip}
    </div>,
    document.body,
  );
};
