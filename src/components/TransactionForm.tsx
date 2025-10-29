import { useEffect, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { addTransaction, Transaction } from "@/lib/storage";
import { toast } from "sonner";

type TransactionType = "income" | "expense";

interface TransactionFormProps {
  initialType?: TransactionType;
  submitLabel?: string;
  onSuccess?: (transaction: Transaction) => void;
}

const TransactionForm = ({
  initialType = "income",
  submitLabel = "Salvar",
  onSuccess,
}: TransactionFormProps) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");

  const resetForm = (nextType: TransactionType = initialType) => {
    setType(nextType);
    setDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setDescription("");
    setPlatform("");
    setCategory("");
  };

  useEffect(() => {
    resetForm(initialType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Digite um valor válido");
      return;
    }

    const transactionData = {
      type,
      amount: parseFloat(amount),
      date: new Date(date).toISOString(),
      description: description || (type === "income" ? "Corridas do dia" : "Despesa"),
      ...(type === "income" && platform && { platform }),
      ...(type === "expense" && category && { category }),
    };

    const savedTransaction = addTransaction(transactionData);
    toast.success(type === "income" ? "Ganho registrado!" : "Gasto registrado!");
    onSuccess?.(savedTransaction);
    resetForm(type);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="income" className="gap-2">
            <Plus size={18} />
            Ganho
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-2">
            <Minus size={18} />
            Gasto
          </TabsTrigger>
        </TabsList>

        <Card className="p-4 space-y-4">
          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 text-lg"
            />
          </div>

          {type === "income" && (
            <div>
              <Label htmlFor="platform">Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Uber">Uber</SelectItem>
                  <SelectItem value="99">99</SelectItem>
                  <SelectItem value="InDriver">InDriver</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "expense" && (
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Combustível">Combustível</SelectItem>
                  <SelectItem value="Pedágio">Pedágio</SelectItem>
                  <SelectItem value="Alimentação">Alimentação</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="description">Observação (opcional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="Ex: Corridas do dia"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>
        </Card>
      </Tabs>

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold"
      >
        {submitLabel}
      </Button>
    </form>
  );
};

export default TransactionForm;
