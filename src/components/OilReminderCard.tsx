import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Droplet, Loader2, Megaphone } from "lucide-react";

type OilReminderCardProps = {
  title: string;
  description: string;
  onRegister: () => void | Promise<void>;
  onSnooze: () => void;
  isRegistering?: boolean;
  className?: string;
};

export const OilReminderCard = ({
  title,
  description,
  onRegister,
  onSnooze,
  isRegistering = false,
  className,
}: OilReminderCardProps) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-background/85 to-background/95 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(245,158,11,0.65)] glass-card animate-fade-in",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,191,36,0.28),transparent_65%),radial-gradient(circle_at_95%_85%,rgba(245,158,11,0.2),transparent_70%)]" />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-100 shadow-[0_12px_32px_-28px_rgba(251,191,36,0.75)]">
            <Megaphone size={20} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">
              Alerta de manutenção
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-amber-50/80">{description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            size="sm"
            className="gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:opacity-90"
            onClick={onRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Droplet size={16} />
                Registrar troca
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-amber-200/40 text-amber-50 hover:bg-amber-500/10"
            onClick={onSnooze}
          >
            Lembrar depois
          </Button>
        </div>
      </div>
    </div>
  );
};
