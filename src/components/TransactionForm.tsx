import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Mic, MicOff, Loader2 } from "lucide-react";
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
import { addTransaction, Transaction } from "@/lib/supabase-storage";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { parseTransactionSpeech } from "@/lib/speech-parser";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type TransactionType = "income" | "expense";

interface TransactionFormProps {
  initialType?: TransactionType;
  submitLabel?: string;
  onSuccess?: (transaction: Transaction) => void;
}

const getTodayInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TransactionForm = ({
  initialType = "income",
  submitLabel = "Salvar",
  onSuccess,
}: TransactionFormProps) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [date, setDate] = useState(getTodayInputValue());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");

  const queryClient = useQueryClient();

  const addTransactionMutation = useMutation({
    mutationFn: addTransaction,
    onSuccess: (savedTransaction, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        variables.type === "income"
          ? "Ganho registrado!"
          : "Gasto registrado!",
      );
      onSuccess?.(savedTransaction);
      resetForm(variables.type);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a transação.";
      toast.error(message);
    },
  });

  // Speech
  const speech = useSpeechRecognition();
  const [lastHeard, setLastHeard] = useState("");
  const micSupported = speech.supported;

  const resetForm = useCallback(
    (nextType: TransactionType = initialType) => {
      setType(nextType);
      setDate(getTodayInputValue());
      setAmount("");
      setDescription("");
      setPlatform("");
      setCategory("");
    },
    [initialType],
  );

  useEffect(() => {
    resetForm(initialType);
  }, [initialType, resetForm]);

  // When transcription arrives, parse and fill form
const lastProcessedTranscriptRef = useRef("");

const VOICE_TOAST_ID = "transaction-voice-feedback";

  const { listening, transcript, stop } = speech;

  useEffect(() => {
    if (listening) {
      lastProcessedTranscriptRef.current = "";
      toast.dismiss(VOICE_TOAST_ID);
    }
  }, [listening]);

  useEffect(() => {
    const currentTranscript = transcript?.trim();
    if (!currentTranscript) {
      return;
    }

    if (currentTranscript === lastProcessedTranscriptRef.current) {
      return;
    }

    const parsed = parseTransactionSpeech(currentTranscript);
    if (!parsed) {
      if (!listening) {
        setLastHeard(currentTranscript);
        toast.warning("Não entendi. Tente dizer: 'Gastei 50 reais de gasolina'.", {
          id: VOICE_TOAST_ID,
        });
        lastProcessedTranscriptRef.current = currentTranscript;
      }
      return;
    }

    setLastHeard(currentTranscript);
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

    lastProcessedTranscriptRef.current = currentTranscript;

    if (listening) {
      stop();
    }

    toast.success("Campos preenchidos por voz. Confira e salve.", {
      id: VOICE_TOAST_ID,
    });
  }, [listening, stop, transcript]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      setDate(getTodayInputValue());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Digite um valor válido");
      return;
    }

    const todayDateValue = getTodayInputValue();
    if (date !== todayDateValue) {
      setDate(todayDateValue);
    }

    const transactionData = {
      type,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      description:
        description || (type === "income" ? "Corridas do dia" : "Despesa"),
      ...(type === "income" && platform && { platform }),
      ...(type === "expense" && category && { category }),
    };

    addTransactionMutation.mutate(transactionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <Tabs
        value={type}
        onValueChange={(value) => setType(value as TransactionType)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/50 backdrop-blur-sm">
          <TabsTrigger
            value="income"
            className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300"
          >
            <Plus size={18} />
            Ganho
          </TabsTrigger>
          <TabsTrigger
            value="expense"
            className="gap-2 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive transition-all duration-300"
          >
            <Minus size={18} />
            Gasto
          </TabsTrigger>
        </TabsList>

        <Card className="p-5 space-y-4 glass-card">
          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              disabled
              title="A data é preenchida automaticamente com o dia atual"
              className="mt-1 cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <Label htmlFor="amount" className="text-foreground font-medium">
              Valor (R$)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
                  <SelectItem value="Particular">Particular</SelectItem>
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
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1"
            />
          </div>

          {/* Voice toolbar */}
          {micSupported && (
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Preencher por voz{" "}
                {lastHeard && (
                  <span className="text-[11px]">• "{lastHeard}"</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {speech.listening ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={speech.stop}
                    className="gap-1"
                    type="button"
                  >
                    <MicOff size={14} />
                    Parar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={speech.start}
                    className="gap-1"
                    type="button"
                  >
                    <Mic size={14} />
                    Falar
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </Tabs>

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
        disabled={addTransactionMutation.isPending}
      >
        {addTransactionMutation.isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Salvando...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
};

export default TransactionForm;
