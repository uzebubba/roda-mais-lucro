import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SUBSCRIPTION_TIERS } from "@/contexts/SubscriptionContext";

const Assinatura = () => {
  const { subscribed, subscription_end, checkSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, planName: string) => {
    setLoading(priceId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Você precisa estar logado para assinar");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
        toast.success(`Redirecionando para o checkout do ${planName}...`);
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao criar sessão de pagamento");
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("portal");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Abrindo portal de gerenciamento...");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Erro ao abrir portal de gerenciamento");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-background p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Escolha seu plano</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Acesse o Roda+ Controle e tenha controle total das suas corridas. Gerencie lucro, custos e metas em tempo real.
          </p>
        </div>

        {subscribed && subscription_end && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Assinatura Ativa</CardTitle>
              <CardDescription>
                Sua assinatura está ativa até {new Date(subscription_end).toLocaleDateString("pt-BR")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleManageSubscription}
                disabled={loading === "portal"}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {loading === "portal" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  "Gerenciar Assinatura"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <Card className={subscribed ? "opacity-75" : ""}>
            <CardHeader>
              <CardTitle className="text-2xl">{SUBSCRIPTION_TIERS.MENSAL.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">R$ 29,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {[
                  "Registro ilimitado de corridas",
                  "Controle de custos fixos e variáveis",
                  "Acompanhamento de metas diárias e mensais",
                  "Histórico completo de transações",
                  "Sincronização em nuvem",
                  "Suporte prioritário via WhatsApp",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout(SUBSCRIPTION_TIERS.MENSAL.price_id, SUBSCRIPTION_TIERS.MENSAL.name)}
                disabled={loading === SUBSCRIPTION_TIERS.MENSAL.price_id || subscribed}
                className="w-full"
                size="lg"
              >
                {loading === SUBSCRIPTION_TIERS.MENSAL.price_id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : subscribed ? (
                  "Plano Atual"
                ) : (
                  "Assinar Agora"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className={`relative ${subscribed ? "opacity-75" : "border-primary/50"}`}>
            {!subscribed && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Melhor Custo-Benefício
                </span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{SUBSCRIPTION_TIERS.ANUAL.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">R$ 199,90</span>
                <span className="text-muted-foreground">/ano</span>
              </div>
              <p className="text-sm text-primary font-semibold">Economize R$ 158,90 por ano!</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {[
                  "Todos os recursos do plano mensal",
                  "12 meses pelo preço de 6,7 meses",
                  "Economia de mais de 44%",
                  "Sem preocupação com renovação mensal",
                  "Prioridade no suporte técnico",
                  "Acesso antecipado a novos recursos",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout(SUBSCRIPTION_TIERS.ANUAL.price_id, SUBSCRIPTION_TIERS.ANUAL.name)}
                disabled={loading === SUBSCRIPTION_TIERS.ANUAL.price_id || subscribed}
                className="w-full"
                size="lg"
              >
                {loading === SUBSCRIPTION_TIERS.ANUAL.price_id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : subscribed ? (
                  "Plano Atual"
                ) : (
                  "Assinar Agora"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-4 pt-8">
          <Button onClick={checkSubscription} variant="outline" size="sm">
            Atualizar Status da Assinatura
          </Button>
          <p className="text-xs text-muted-foreground">
            Todos os pagamentos são processados de forma segura pelo Stripe. Você pode cancelar sua assinatura a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Assinatura;
