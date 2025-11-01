import {
  ArrowLeft,
  Crown,
  Download,
  MessageCircle,
  Save,
  Megaphone,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/lib/supabase-storage";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const Perfil = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    enabled: Boolean(user?.id),
    retry: false,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || metadataName || "");
      setEmail(profile.email ?? user?.email ?? "");
      setIsEditing(profile.fullName === "João Motorista");
    }
  }, [profile, metadataName, user?.email]);

  useEffect(() => {
    if (profileQuery.error) {
      const error = profileQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados do perfil.";
      toast.error(message);
    }
  }, [profileQuery.error]);

  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
  });

  useEffect(() => {
    if (!profile || updateProfileMutation.isPending) {
      return;
    }
    const shouldSyncName =
      Boolean(metadataName) && profile.fullName === "João Motorista";
    const shouldSyncEmail =
      Boolean(user?.email) && profile.email === "joao@email.com";

    if (!shouldSyncName && !shouldSyncEmail) {
      return;
    }

    const run = async () => {
      try {
        const updated = await updateProfileMutation.mutateAsync({
          fullName: shouldSyncName ? metadataName : profile.fullName,
          email: shouldSyncEmail ? user?.email ?? profile.email : profile.email,
        });
        queryClient.setQueryData(["userProfile"], updated);
        setFullName(updated.fullName);
        setEmail(updated.email);
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to sync user profile", error);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataName, profile, user?.email]);

  const displayedEmail = useMemo(() => {
    return email || user?.email || profile?.email || "";
  }, [email, user?.email, profile?.email]);

  const avatarInitials = useMemo(() => {
    if (profile?.avatarInitials && profile.avatarInitials.length > 0) {
      return profile.avatarInitials;
    }
    if (fullName.trim().length > 0) {
      return fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
    }
    return "JM";
  }, [profile?.avatarInitials, fullName]);

  const handleWhatsApp = () => {
    window.open(
      "https://wa.me/5511999999999?text=Olá, preciso de ajuda com o Roda+ Controle",
      "_blank",
    );
  };

  const handleExport = () => {
    alert("Funcionalidade de exportar dados será implementada em breve!");
  };

  const handleSaveProfile = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Informe seu nome para personalizar a experiência.");
      return;
    }

    try {
      const updated = await updateProfileMutation.mutateAsync({
        fullName: trimmedName,
        email: email.trim(),
      });
      queryClient.setQueryData(["userProfile"], updated);
      setFullName(updated.fullName);
      setEmail(updated.email);
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o perfil.";
      toast.error(message);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Você saiu da sua conta.");
      navigate("/login", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar a sessão.";
      toast.error(message);
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const planDueDate = "15/06/2025";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center justify-between gap-3 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="flex-1 text-center text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Perfil
        </h1>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sair
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4 animate-fade-in">
        {/* User Info */}
        <Card className="p-6 glass-card animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {fullName || "Motorista Roda+"}
                </h2>
                <p className="text-sm text-muted-foreground">{displayedEmail}</p>
              </div>
            </div>
            {!isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartEditing}
                className="h-8 text-sm font-medium text-primary hover:text-primary/80"
              >
                Editar dados
              </Button>
            )}
          </div>
          {isEditing && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Seu nome</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Digite como quer ser chamado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar dados
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* Plan Card */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Crown size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Plano Ativo</h3>
              <p className="text-2xl font-bold text-primary mt-1">R$ 29,90/mês</p>
              <p className="text-xs text-muted-foreground mt-2">
                Próxima cobrança: {planDueDate}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Gerenciar assinatura
              </Button>
            </div>
          </div>
        </Card>

        {/* Options */}
        <div className="space-y-3 animate-fade-in">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleWhatsApp}
          >
            <span className="flex items-center gap-3">
              <MessageCircle size={18} />
              Suporte via WhatsApp
            </span>
            <span className="text-xs text-muted-foreground">Em horário comercial</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleExport}
          >
            <span className="flex items-center gap-3">
              <Download size={18} />
              Exportar dados
            </span>
            <span className="text-xs text-muted-foreground">CSV / Excel</span>
          </Button>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-3">
              <Megaphone size={18} />
              Novidades do produto
            </span>
            <span className="text-xs text-muted-foreground">Em breve</span>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Perfil;
