import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const data = [
  { name: "Autorizadas", value: 1245, color: "hsl(142, 71%, 35%)" },
  { name: "Rejeitadas", value: 23, color: "hsl(0, 72%, 51%)" },
  { name: "Canceladas", value: 87, color: "hsl(215, 16%, 47%)" },
  { name: "Processando", value: 5, color: "hsl(38, 92%, 50%)" },
];

export function StatusChart() {
  return (
    <div className="card-elevated p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Status das NFC-e</h3>
        <p className="text-sm text-muted-foreground">Distribuição por status (últimos 30 dias)</p>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
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
        {data.map((item) => (
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
    </div>
  );
}
