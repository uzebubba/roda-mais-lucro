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
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={20} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${variantStyles[variant]}`}>
        R$ {value.toFixed(2).replace(".", ",")}
      </p>
    </Card>
  );
};
