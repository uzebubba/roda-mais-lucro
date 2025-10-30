import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: "success" | "danger" | "neutral";
}

export const SummaryCard = ({ title, value, icon: Icon, variant }: SummaryCardProps) => {
  const variantStyles = {
    success: "text-primary",
    danger: "text-destructive",
    neutral: "text-foreground",
  };

  return (
    <Card className="p-4 flex flex-col gap-2 glass-card hover:border-border transition-all duration-300 group">
      <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
        <div className={`p-1.5 rounded-lg ${variant === 'success' ? 'bg-primary/10' : variant === 'danger' ? 'bg-destructive/10' : 'bg-muted'}`}>
          <Icon size={18} />
        </div>
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className={`text-xl font-bold ${variantStyles[variant]}`}>
        R$ {value.toFixed(2).replace(".", ",")}
      </p>
    </Card>
  );
};
