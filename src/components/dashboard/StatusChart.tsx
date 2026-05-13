import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useNFCeStats } from "@/hooks/useDashboardData";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Loader2 } from "lucide-react";

const COLORS: Record<string, string> = {
  autorizada: "hsl(142, 71%, 35%)",
  rejeitada: "hsl(0, 72%, 51%)",
  cancelada: "hsl(215, 16%, 47%)",
  processando: "hsl(38, 92%, 50%)",
  pendente: "hsl(200, 70%, 50%)",
  denegada: "hsl(280, 50%, 50%)",
  contingencia: "hsl(30, 80%, 50%)",
};

const LABELS: Record<string, string> = {
  autorizada: "Autorizadas",
  rejeitada: "Rejeitadas",
  cancelada: "Canceladas",
  processando: "Processando",
  pendente: "Pendentes",
  denegada: "Denegadas",
  contingencia: "Contingência",
};

export function StatusChart() {
  const { ambiente } = useEnvironment();
  const { data: stats, isLoading } = useNFCeStats(ambiente);

  const chartData = stats
    ?.filter(s => s.count > 0)
    .map(s => ({
      name: LABELS[s.status] || s.status,
      value: s.count,
      color: COLORS[s.status] || "hsl(0, 0%, 60%)",
    })) || [];

  const hasData = chartData.length > 0;

  return (
    <div className="card-elevated p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Status das NFC-e</h3>
        <p className="text-sm text-muted-foreground">Distribuição por status (últimos 30 dias)</p>
      </div>
      
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !hasData ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Nenhuma NFC-e emitida ainda</p>
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString("pt-BR"), ""]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "var(--shadow-md)",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-sm text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">{item.name}</span>
                <span className="text-xs font-semibold text-foreground ml-auto tabular-nums">
                  {item.value.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
