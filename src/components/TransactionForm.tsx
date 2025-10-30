import { useEffect, useState } from "react";
import { Plus, Minus, Mic, MicOff } from "lucide-react";
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
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { parseTransactionSpeech } from "@/lib/speech-parser";

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

  // Speech
  const speech = useSpeechRecognition();
  const [lastHeard, setLastHeard] = useState("");
  const micSupported = speech.supported;

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

  // When transcription arrives, parse and fill form
  useEffect(() => {
    if (!speech.transcript) return;
    setLastHeard(speech.transcript);
    const parsed = parseTransactionSpeech(speech.transcript);
    if (!parsed) {
      toast.warning("Não entendi. Tente dizer: 'Gastei 50 reais de gasolina'.");
      return;
    }

    if (parsed.amount !== null) {
      setAmount(parsed.amount.toString());
    }
    setDescription(parsed.description);

    if (parsed.type === "expense") {
      setType("expense");
      setCategory(parsed.category || "");
      setPlatform("");
    } else {
      setType("income");
      setPlatform(parsed.platform || "");
      setCategory("");
    }

    toast.success("Campos preenchidos por voz. Confira e salve.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript]);

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
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/50 backdrop-blur-sm">
          <TabsTrigger value="income" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300">
            <Plus size={18} />
            Ganho
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-2 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive transition-all duration-300">
            <Minus size={18} />
            Gasto
          </TabsTrigger>
        </TabsList>

        <Card className="p-5 space-y-4 glass-card">
          {/* Voice toolbar */}
          {micSupported && (
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Preencher por voz {lastHeard && <span className="text-[11px]">• "{lastHeard}"</span>}
              </div>
              <div className="flex items-center gap-2">
                {speech.listening ? (
                  <Button variant="destructive" size="sm" onClick={speech.stop} className="gap-1">
                    <MicOff size={14} />
                    Parar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={speech.start} className="gap-1">
                    <Mic size={14} />
                    Falar
                  </Button>
                )}
              </div>
            </div>
          )}
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
            <Label htmlFor="amount" className="text-foreground font-medium">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 text-lg font-semibold"
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
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
      >
        {submitLabel}
      </Button>
    </form>
  );
};

export default TransactionForm;
