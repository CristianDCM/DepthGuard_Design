import { Link, useLocation } from "react-router-dom";
import { Home, Video, History, Users, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { name: "Inicio", icon: Home, path: "/dashboard" },
    { name: "Vivo", icon: Video, path: "/live" },
    { name: "Historial", icon: History, path: "/history" },
    { name: "Usuarios", icon: Users, path: "/users" },
    { name: "Ajustes", icon: Settings, path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-dg-bg border-t border-dg-border px-2 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-7xl mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-dg-accent" : "text-dg-text-muted hover:text-dg-accent"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "fill-dg-accent/20")} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
