import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, ShoppingCart, Truck } from "lucide-react";
import { Empresa } from "@/hooks/useSupabaseData";
import { SeriesFiscaisManager } from "@/components/empresas/SeriesFiscaisManager";
import { cn } from "@/lib/utils";

const modelos = [
  { id: "nfe" as const, label: "NF-e (Modelo 55)", desc: "Nota Fiscal Eletrônica para vendas entre empresas", icon: FileText },
  { id: "nfce" as const, label: "NFC-e (Modelo 65)", desc: "Cupom Fiscal Eletrônico para venda ao consumidor", icon: ShoppingCart },
  { id: "mdfe" as const, label: "MDF-e (Modelo 58)", desc: "Manifesto Eletrônico para transporte de cargas", icon: Truck },
];

interface Props {
  empresa: Empresa;
  selected: Set<"nfe" | "nfce" | "mdfe">;
  onSelectedChange: (s: Set<"nfe" | "nfce" | "mdfe">) => void;
  onContinue: () => void;
}

export function StepSeries({ empresa, selected, onSelectedChange, onContinue }: Props) {
  const [touched, setTouched] = useState(false);

  const toggle = (id: "nfe" | "nfce" | "mdfe") => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectedChange(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Quais documentos esta empresa irá emitir?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {modelos.map(m => {
            const active = selected.has(m.id);
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" onClick={() => toggle(m.id)}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all flex flex-col gap-2",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}>
                <div className="flex items-center justify-between">
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                  <Checkbox checked={active} />
                </div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="space-y-6 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Uma série padrão já foi criada automaticamente. Você pode adicionar ou ajustar a numeração de cada modelo.
          </p>
          {Array.from(selected).map(tipo => (
            <div key={tipo} className="card-elevated p-4">
              <SeriesFiscaisManager empresaId={empresa.id} tipo={tipo} />
            </div>
          ))}
        </div>
      )}

      {selected.size === 0 && touched && (
        <p className="text-sm text-warning">Selecione ao menos um modelo para prosseguir.</p>
      )}

      <div className="flex justify-end">
        <Button
          className="btn-gradient"
          onClick={() => { setTouched(true); if (selected.size > 0) onContinue(); }}
        >
          Avançar
        </Button>
      </div>
    </div>
  );
}
