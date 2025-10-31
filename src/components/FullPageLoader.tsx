import { Loader2 } from "lucide-react";

const FullPageLoader = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="h-10 w-10 animate-spin" />
      <p className="text-sm font-medium">Carregando...</p>
    </div>
  );
};

export default FullPageLoader;
