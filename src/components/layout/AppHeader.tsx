import { Bell, Search, ChevronDown, AlertTriangle, CheckCircle2, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnvironment, type Ambiente } from "@/contexts/EnvironmentContext";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

const AMBIENTES: { value: Ambiente; label: string; color: string; icon: typeof Beaker }[] = [
  { value: "producao", label: "Produção", color: "bg-success", icon: CheckCircle2 },
  { value: "homologacao", label: "Homologação", color: "bg-warning", icon: Beaker },
  { value: "todos", label: "Todos os ambientes", color: "bg-info", icon: AlertTriangle },
];

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const navigate = useNavigate();
  const { ambiente, setAmbiente } = useEnvironment();
  const { data: stats } = useDashboardStats(ambiente);
  const [search, setSearch] = useState("");

  const current = AMBIENTES.find(a => a.value === ambiente)!;
  const Icon = current.icon;

  const alertasCount = (stats?.rejeitadasHoje ?? 0) + (stats?.certsExpirando ?? 0) + (stats?.certsExpirados ?? 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/nfce?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar NFC-e por número, chave..."
            className="w-72 pl-9 bg-background input-focus-ring"
          />
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className={cn("h-2 w-2 rounded-full animate-pulse-subtle", current.color)} />
              {current.label}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filtrar por ambiente</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AMBIENTES.map(a => {
              const AIcon = a.icon;
              return (
                <DropdownMenuItem
                  key={a.value}
                  onClick={() => setAmbiente(a.value)}
                  className={cn("gap-2", ambiente === a.value && "bg-muted")}
                >
                  <span className={cn("h-2 w-2 rounded-full", a.color)} />
                  <AIcon className="h-4 w-4" />
                  <span className="flex-1">{a.label}</span>
                  {ambiente === a.value && <CheckCircle2 className="h-4 w-4 text-success" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {alertasCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                  {alertasCount > 99 ? "99+" : alertasCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Alertas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alertasCount === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhum alerta no momento
              </div>
            ) : (
              <>
                {(stats?.rejeitadasHoje ?? 0) > 0 && (
                  <DropdownMenuItem onClick={() => navigate("/nfce?status=rejeitada")}>
                    <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                    {stats?.rejeitadasHoje} NFC-e/NF-e rejeitadas hoje
                  </DropdownMenuItem>
                )}
                {(stats?.certsExpirando ?? 0) > 0 && (
                  <DropdownMenuItem onClick={() => navigate("/certificados")}>
                    <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
                    {stats?.certsExpirando} certificado(s) expirando
                  </DropdownMenuItem>
                )}
                {(stats?.certsExpirados ?? 0) > 0 && (
                  <DropdownMenuItem onClick={() => navigate("/certificados")}>
                    <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                    {stats?.certsExpirados} certificado(s) vencido(s)
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
