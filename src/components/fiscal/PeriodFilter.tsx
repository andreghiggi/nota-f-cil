import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodoPreset = "todos" | "hoje" | "7d" | "30d" | "mes" | "personalizado";

export interface PeriodoRange {
  preset: PeriodoPreset;
  inicio: string | null; // ISO date (yyyy-mm-dd)
  fim: string | null;
}

function toISODate(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function usePeriodoFilter(initial: PeriodoPreset = "todos") {
  const [preset, setPreset] = useState<PeriodoPreset>(initial);
  const [inicio, setInicio] = useState<string>("");
  const [fim, setFim] = useState<string>("");

  const range = useMemo<PeriodoRange>(() => {
    const hoje = new Date();
    const start = new Date(hoje);
    switch (preset) {
      case "hoje":
        break;
      case "7d":
        start.setDate(start.getDate() - 6);
        break;
      case "30d":
        start.setDate(start.getDate() - 29);
        break;
      case "mes":
        start.setDate(1);
        break;
      case "personalizado":
        return {
          preset,
          inicio: inicio || null,
          fim: fim || null,
        };
      default:
        return { preset, inicio: null, fim: null };
    }
    return { preset, inicio: toISODate(start), fim: toISODate(hoje) };
  }, [preset, inicio, fim]);

  return { preset, setPreset, inicio, setInicio, fim, setFim, range };
}

/**
 * Aplica o range de período em uma query do Supabase sobre a coluna informada.
 * Usa limites de dia inteiro no fuso local para não cortar notas do dia atual.
 */
export function applyPeriodo<T>(query: T, range: PeriodoRange, column = "data_emissao"): T {
  const q = query as any;
  if (range.inicio) q.gte(column, `${range.inicio}T00:00:00`);
  if (range.fim) q.lte(column, `${range.fim}T23:59:59.999`);
  return q as T;
}

interface PeriodFilterProps {
  preset: PeriodoPreset;
  setPreset: (p: PeriodoPreset) => void;
  inicio: string;
  setInicio: (v: string) => void;
  fim: string;
  setFim: (v: string) => void;
}

export function PeriodFilter({ preset, setPreset, inicio, setInicio, fim, setFim }: PeriodFilterProps) {
  return (
    <>
      <div className="w-48">
        <label className="text-sm font-medium text-foreground mb-1.5 block">Período</label>
        <Select value={preset} onValueChange={(v) => setPreset(v as PeriodoPreset)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo o histórico</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="personalizado">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {preset === "personalizado" && (
        <>
          <div className="w-40">
            <label className="text-sm font-medium text-foreground mb-1.5 block">De</label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="w-40">
            <label className="text-sm font-medium text-foreground mb-1.5 block">Até</label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </>
      )}
    </>
  );
}
