import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTutorial, useTutorialAnchor } from "@/contexts/TutorialContext";

type TutorialHelpButtonProps = {
  className?: string;
  variant?: "default" | "inverted";
};

export const TutorialHelpButton = ({
  className,
  variant = "default",
}: TutorialHelpButtonProps) => {
  const { openTutorial } = useTutorial();
  const anchorRef = useTutorialAnchor<HTMLButtonElement>("help-button");

  return (
    <button
      type="button"
      ref={anchorRef}
      onClick={() => openTutorial()}
      aria-label="Rever tutorial do app"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "inverted"
          ? "border border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white focus-visible:ring-white/60 focus-visible:ring-offset-transparent"
          : "border border-border/60 bg-card/80 text-muted-foreground backdrop-blur hover:text-foreground",
        className,
      )}
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
};
