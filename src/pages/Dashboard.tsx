import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentNFCeTable } from "@/components/dashboard/RecentNFCeTable";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SefazStatusDialog } from "@/components/dashboard/SefazStatusDialog";
import { Receipt, CheckCircle2, XCircle, Building2, AlertTriangle, DollarSign, TrendingUp, ShieldAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { cn } from "@/lib/utils";

const ambienteMeta = {
  producao: { label: "Produção", color: "bg-success", text: "text-success" },
  homologacao: { label: "Homologação", color: "bg-warning", text: "text-warning" },
  todos: { label: "Todos os ambientes", color: "bg-info", text: "text-info" },
} as const;

export default function Dashboard() {
  const [sefazOpen, setSefazOpen] = useState(false);
  const { ambiente } = useEnvironment();
  const { data: stats, isLoading } = useDashboardStats(ambiente);
  const navigate = useNavigate();

  const meta = ambienteMeta[ambiente];

  const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <AppLayout 
      title="Dashboard" 
      subtitle="Visão geral da plataforma de emissão fiscal"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse-subtle", meta.color)} />
            <p className="text-sm text-muted-foreground">
              Ambiente: <span className={cn("font-semibold", meta.text)}>{meta.label}</span>
            </p>
            <span className="text-xs text-muted-foreground/60 ml-2">Use o seletor no topo para alternar</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => setSefazOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Status SEFAZ
            </Button>
            <Button size="sm" className="btn-gradient" onClick={() => navigate("/empresas")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Documentos Hoje"
            value={isLoading ? "..." : (stats?.totalDocHoje?.toLocaleString("pt-BR") ?? "0")}
            subtitle={`${stats?.totalNfceHoje ?? 0} NFC-e · ${stats?.totalNfeHoje ?? 0} NF-e`}
            icon={<Receipt className="h-5 w-5" />}
            variant="default"
          />
          <MetricCard
            title="Taxa de Autorização"
            value={isLoading ? "..." : `${stats?.taxaAutorizacao ?? "0"}%`}
            subtitle={`${stats?.autorizadasHoje ?? 0} autorizadas`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Faturamento Hoje"
            value={isLoading ? "..." : formatBRL(stats?.valorAutorizadoHoje ?? 0)}
            subtitle={`Ticket médio ${formatBRL(stats?.ticketMedio ?? 0)}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="default"
          />
          <MetricCard
            title="Rejeições Hoje"
            value={isLoading ? "..." : (stats?.rejeitadasHoje?.toString() ?? "0")}
            subtitle={(stats?.rejeitadasHoje ?? 0) > 0 ? "Verifique os logs" : "Nenhuma rejeição"}
            icon={<XCircle className="h-5 w-5" />}
            variant={(stats?.rejeitadasHoje ?? 0) > 0 ? "destructive" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Empresas Ativas"
            value={isLoading ? "..." : (stats?.totalEmpresas?.toString() ?? "0")}
            subtitle="No ambiente selecionado"
            icon={<Building2 className="h-5 w-5" />}
            variant="default"
          />
          <MetricCard
            title="Certificados Expirando"
            value={isLoading ? "..." : (stats?.certsExpirando?.toString() ?? "0")}
            subtitle="Próximos 30 dias"
            icon={<ShieldAlert className="h-5 w-5" />}
            variant={(stats?.certsExpirando ?? 0) > 0 ? "destructive" : "default"}
          />
          <MetricCard
            title="Certificados Vencidos"
            value={isLoading ? "..." : (stats?.certsExpirados?.toString() ?? "0")}
            subtitle="Renovar imediatamente"
            icon={<TrendingUp className="h-5 w-5" />}
            variant={(stats?.certsExpirados ?? 0) > 0 ? "destructive" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <StatusChart />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>
        </div>

        <RecentNFCeTable />
      </div>

      <SefazStatusDialog open={sefazOpen} onOpenChange={setSefazOpen} />
    </AppLayout>
  );
}
