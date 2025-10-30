import { ArrowLeft, Crown, Download, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/storage";

const Perfil = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email ?? "");

  const handleWhatsApp = () => {
    window.open("https://wa.me/5511999999999?text=Olá, preciso de ajuda com o Roda+ Controle", "_blank");
  };

  const handleExport = () => {
    // Placeholder for export functionality
    alert("Funcionalidade de exportar dados será implementada em breve!");
  };

  const handleSaveProfile = () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Informe seu nome para personalizar a experiência.");
      return;
    }

    const updated = updateUserProfile({
      fullName: trimmedName,
      email: email.trim(),
      avatarInitials: trimmedName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
    });
    setProfile(updated);
    setFullName(updated.fullName);
    setEmail(updated.email);
    toast.success("Perfil atualizado com sucesso!");
  };

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
        <h1 className="text-xl font-bold">Perfil</h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* User Info */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {profile.avatarInitials && profile.avatarInitials.length > 0
                  ? profile.avatarInitials
                  : "JM"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.fullName}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
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
            <Button className="w-full gap-2" onClick={handleSaveProfile}>
              <Save size={16} />
              Salvar dados
            </Button>
          </div>
        </Card>

        {/* Plan Card */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Crown size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Plano Ativo</h3>
              <p className="text-2xl font-bold text-primary mt-1">R$ 29,90/mês</p>
              <p className="text-xs text-muted-foreground mt-2">
                Próxima cobrança: 15/06/2025
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
        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-14"
            onClick={handleExport}
          >
            <Download size={20} />
            <span className="text-base">Exportar dados</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-14 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={handleWhatsApp}
          >
            <MessageCircle size={20} />
            <span className="text-base">Suporte via WhatsApp</span>
          </Button>
        </div>

        {/* Info */}
        <Card className="p-4 bg-muted border-0">
          <p className="text-xs text-muted-foreground text-center">
            Roda+ Controle v1.0.0
            <br />
            Desenvolvido para motoristas de aplicativo
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Perfil;
