import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentNFCeTable } from "@/components/dashboard/RecentNFCeTable";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SefazStatusDialog } from "@/components/dashboard/SefazStatusDialog";
import { Receipt, CheckCircle2, XCircle, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [sefazOpen, setSefazOpen] = useState(false);
  const { data: stats, isLoading } = useDashboardStats();
  const navigate = useNavigate();

  return (
    <AppLayout 
      title="Dashboard" 
      subtitle="Visão geral da plataforma de emissão fiscal"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Quick actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Ambiente: <span className="font-medium text-foreground">Homologação</span>
            </p>
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="NFC-e Emitidas (Hoje)"
            value={isLoading ? "..." : (stats?.totalNfceHoje?.toLocaleString("pt-BR") ?? "0")}
            subtitle="Total de notas fiscais"
            icon={<Receipt className="h-5 w-5" />}
            variant="default"
          />
          <MetricCard
            title="Taxa de Autorização"
            value={isLoading ? "..." : `${stats?.taxaAutorizacao ?? "0"}%`}
            subtitle="Autorizadas / Total"
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Rejeições (Hoje)"
            value={isLoading ? "..." : (stats?.rejeitadasHoje?.toString() ?? "0")}
            subtitle="Notas rejeitadas"
            icon={<XCircle className="h-5 w-5" />}
            variant="destructive"
          />
          <MetricCard
            title="Empresas Ativas"
            value={isLoading ? "..." : (stats?.totalEmpresas?.toString() ?? "0")}
            subtitle="Com certificado válido"
            icon={<Building2 className="h-5 w-5" />}
            variant="default"
          />
        </div>

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <StatusChart />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>
        </div>

        {/* Recent NFC-e Table */}
        <RecentNFCeTable />
      </div>

      <SefazStatusDialog open={sefazOpen} onOpenChange={setSefazOpen} />
    </AppLayout>
  );
}
