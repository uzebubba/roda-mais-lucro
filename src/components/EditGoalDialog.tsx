import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { toast } from "sonner";

interface EditGoalDialogProps {
  initialDaily: number;
  initialMonthly: number;
  onSave: (daily: number, monthly: number) => void;
}

const formatCurrencyValue = (value: string) => {
  const numeric = value.replace(/[^\d,\.]/g, "").replace(",", ".");
  return numeric;
};

const formatDisplay = (value: number) =>
  value
    .toFixed(2)
    .replace(".", ",");

export const EditGoalDialog = ({ initialDaily, initialMonthly, onSave }: EditGoalDialogProps) => {
  const [open, setOpen] = useState(false);
  const [dailyValue, setDailyValue] = useState(formatDisplay(initialDaily));
  const [monthlyValue, setMonthlyValue] = useState(formatDisplay(initialMonthly));

  const handleSave = () => {
    const daily = parseFloat(formatCurrencyValue(dailyValue)) || 0;
    const monthly = parseFloat(formatCurrencyValue(monthlyValue)) || 0;

    if (daily <= 0 || monthly <= 0) {
      toast.error("Informe metas maiores que zero.");
      return;
    }

    onSave(daily, monthly);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDailyValue(formatDisplay(initialDaily));
      setMonthlyValue(formatDisplay(initialMonthly));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Target size={16} />
          Ajustar metas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Ajustar metas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-goal">Meta diária (R$)</Label>
            <Input
              id="daily-goal"
              value={dailyValue}
              onChange={(event) => setDailyValue(event.target.value)}
              inputMode="decimal"
              placeholder="Ex: 300,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly-goal">Meta mensal (R$)</Label>
            <Input
              id="monthly-goal"
              value={monthlyValue}
              onChange={(event) => setMonthlyValue(event.target.value)}
              inputMode="decimal"
              placeholder="Ex: 6000,00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave} className="w-full">
            Salvar metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
