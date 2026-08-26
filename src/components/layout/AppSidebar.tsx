import {
  LayoutDashboard,
  Building2,
  FileText,
  ShieldCheck,
  Settings,
  Key,
  Activity,
  LogOut,
  Receipt,
  BookOpen,
  Webhook,
  Truck,
  Rocket,
  Inbox,
  FileSignature,
  PackageCheck,
  Bus,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type NavItem = { name: string; href: string; icon: typeof FileText };
type NavGroup = { id: string; name: string; icon: typeof FileText; items: NavItem[] };

const topLevel: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Empresas", href: "/empresas", icon: Building2 },
  { name: "Novo Cliente", href: "/onboarding", icon: Rocket },
];

const groups: NavGroup[] = [
  {
    id: "fiscais",
    name: "Módulos Fiscais",
    icon: Layers,
    items: [
      { name: "NF-e", href: "/nfe", icon: FileText },
      { name: "NFC-e", href: "/nfce", icon: Receipt },
      { name: "MDF-e", href: "/mdfe", icon: Truck },
      { name: "NFS-e", href: "/nfse", icon: FileSignature },
      { name: "CT-e", href: "/cte", icon: PackageCheck },
      { name: "CT-e OS", href: "/cte-os", icon: Bus },
    ],
  },
  {
    id: "manifestacao",
    name: "Manifestação Eletrônica",
    icon: Inbox,
    items: [{ name: "Notas Recebidas", href: "/notas-recebidas", icon: Inbox }],
  },
  {
    id: "config",
    name: "Configurações",
    icon: Settings,
    items: [
      { name: "Certificados", href: "/certificados", icon: ShieldCheck },
      { name: "Tokens API", href: "/tokens", icon: Key },
      { name: "Webhooks", href: "/webhooks", icon: Webhook },
      { name: "Logs", href: "/logs", icon: Activity },
      { name: "Parâmetros", href: "/configuracoes", icon: Settings },
    ],
  },
];

const STORAGE_KEY = "sidebar:open-groups";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const groupForPath = (path: string) =>
    groups.find((g) => g.items.some((i) => i.href === path))?.id;

  const [open, setOpen] = useState<string[]>(() => {
    let stored: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = [];
    }
    const active = groupForPath(location.pathname);
    return active && !stored.includes(active) ? [...stored, active] : stored;
  });

  useEffect(() => {
    const active = groupForPath(location.pathname);
    if (active) {
      setOpen((prev) => (prev.includes(active) ? prev : [...prev, active]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {
      /* ignore */
    }
  }, [open]);

  const toggle = (id: string) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const handleSignOut = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/auth");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    const parts = user.email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const linkClass = (isActive: boolean, nested = false) =>
    cn(
      "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
      nested ? "px-3 py-2 pl-9" : "px-3 py-2.5",
      isActive
        ? "bg-sidebar-accent text-sidebar-primary"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
    );

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">NFC-e SaaS</span>
          <span className="text-xs text-sidebar-foreground/60">Plataforma Fiscal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {topLevel.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link key={item.name} to={item.href} className={linkClass(isActive)}>
              <item.icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
              {item.name}
            </Link>
          );
        })}

        {groups.map((group) => {
          const isOpen = open.includes(group.id);
          const hasActive = group.items.some((i) => i.href === location.pathname);
          return (
            <div key={group.id} className="pt-1">
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={isOpen}
                className={cn(
                  linkClass(false),
                  "w-full justify-between",
                  hasActive && "text-sidebar-foreground",
                )}
              >
                <span className="flex items-center gap-3">
                  <group.icon className={cn("h-5 w-5", hasActive && "text-sidebar-primary")} />
                  {group.name}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link key={item.href} to={item.href} className={linkClass(isActive, true)}>
                        <item.icon className={cn("h-4 w-4", isActive && "text-sidebar-primary")} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link to="/docs" className={linkClass(location.pathname === "/docs")}>
          <BookOpen className="h-5 w-5" />
          Documentação API
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>

      {/* User info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-semibold text-sidebar-primary">{getUserInitials()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email?.split("@")[0] || "Usuário"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
