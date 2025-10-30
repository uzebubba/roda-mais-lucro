import { Home, Fuel, History, Calendar, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Fuel, label: "Combustível", path: "/registrar" },
  { icon: History, label: "Histórico", path: "/historico" },
  { icon: Calendar, label: "Fixas", path: "/fixas" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border/50 z-50 shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] relative",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground hover:scale-105"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 rounded-xl animate-fade-in" />
                )}
                <item.icon size={22} className="relative z-10" />
                <span className="text-[10px] font-medium relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
