import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTutorial, useTutorialAnchor } from "@/contexts/TutorialContext";

type TutorialHelpButtonProps = {
  className?: string;
};

export const TutorialHelpButton = ({ className }: TutorialHelpButtonProps) => {
  const { openTutorial } = useTutorial();
  const anchorRef = useTutorialAnchor<HTMLButtonElement>("help-button");

  return (
    <button
      type="button"
      ref={anchorRef}
      onClick={() => openTutorial()}
      aria-label="Rever tutorial do app"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground shadow-lg backdrop-blur transition hover:scale-105 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
};
