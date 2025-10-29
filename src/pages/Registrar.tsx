import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransactionForm from "@/components/TransactionForm";

const Registrar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "income";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold">Registrar</h1>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <TransactionForm
          initialType={initialType === "expense" ? "expense" : "income"}
          onSuccess={() => navigate("/historico")}
        />
      </main>
    </div>
  );
};

export default Registrar;
