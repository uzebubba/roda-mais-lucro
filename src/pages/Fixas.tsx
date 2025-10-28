import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getFixedExpenses, addFixedExpense, toggleFixedExpensePaid, FixedExpense } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Fixas = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = () => {
    setExpenses(getFixedExpenses());
  };

  const handleToggle = (id: string) => {
    toggleFixedExpensePaid(id);
    loadExpenses();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !amount || !dueDay) {
      toast.error("Preencha todos os campos");
      return;
    }

    addFixedExpense({
      name,
      amount: parseFloat(amount),
      dueDay: parseInt(dueDay),
      paid: false,
    });

    toast.success("Despesa fixa adicionada!");
    setName("");
    setAmount("");
    setDueDay("");
    setDialogOpen(false);
    loadExpenses();
  };

  const formatAmount = (amount: number) => {
    return amount.toFixed(2).replace(".", ",");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-full"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold">Contas Fixas</h1>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus size={16} />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Despesa Fixa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Financiamento"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dueDay">Dia do vencimento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex: 10"
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {expenses.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma conta fixa cadastrada</p>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-muted rounded-lg">
                    <Calendar size={20} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{expense.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        Vence dia {expense.dueDay}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-destructive mt-1">
                      R$ {formatAmount(expense.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={expense.paid}
                    onCheckedChange={() => handleToggle(expense.id)}
                  />
                  <span
                    className={`text-xs font-medium ${
                      expense.paid ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {expense.paid ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default Fixas;
