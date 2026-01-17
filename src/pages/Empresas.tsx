import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Building2, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Edit,
  Trash2,
  Settings
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  uf: string;
  regime: "simples" | "lucro_presumido" | "lucro_real";
  certificadoStatus: "valido" | "expirando" | "expirado" | "pendente";
  certificadoVencimento?: string;
  ambiente: "homologacao" | "producao";
  nfceHoje: number;
}

const empresas: Empresa[] = [
  {
    id: "1",
    razaoSocial: "Loja Centro Comércio Ltda",
    nomeFantasia: "Loja Centro",
    cnpj: "12.345.678/0001-90",
    uf: "SP",
    regime: "simples",
    certificadoStatus: "valido",
    certificadoVencimento: "2025-06-15",
    ambiente: "producao",
    nfceHoje: 145,
  },
  {
    id: "2",
    razaoSocial: "Supermercado ABC S.A.",
    nomeFantasia: "Supermercado ABC",
    cnpj: "98.765.432/0001-10",
    uf: "RJ",
    regime: "lucro_presumido",
    certificadoStatus: "expirando",
    certificadoVencimento: "2024-02-28",
    ambiente: "producao",
    nfceHoje: 523,
  },
  {
    id: "3",
    razaoSocial: "Farmácia Popular Ltda",
    nomeFantasia: "Farmácia Popular",
    cnpj: "11.222.333/0001-44",
    uf: "MG",
    regime: "simples",
    certificadoStatus: "expirado",
    certificadoVencimento: "2024-01-10",
    ambiente: "homologacao",
    nfceHoje: 0,
  },
  {
    id: "4",
    razaoSocial: "Padaria do Zé ME",
    nomeFantasia: "Padaria do Zé",
    cnpj: "55.666.777/0001-88",
    uf: "SP",
    regime: "simples",
    certificadoStatus: "valido",
    certificadoVencimento: "2025-03-20",
    ambiente: "producao",
    nfceHoje: 89,
  },
  {
    id: "5",
    razaoSocial: "Tech Store Eletrônicos Ltda",
    nomeFantasia: "Tech Store",
    cnpj: "33.444.555/0001-66",
    uf: "PR",
    regime: "lucro_real",
    certificadoStatus: "pendente",
    ambiente: "homologacao",
    nfceHoje: 0,
  },
];

const regimeLabels = {
  simples: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

const certificadoStyles = {
  valido: { label: "Válido", class: "status-autorizada" },
  expirando: { label: "Expirando", class: "status-processando" },
  expirado: { label: "Expirado", class: "status-rejeitada" },
  pendente: { label: "Pendente", class: "status-cancelada" },
};

export default function Empresas() {
  return (
    <AppLayout title="Empresas" subtitle="Gerencie as empresas cadastradas na plataforma">
      <div className="space-y-6 animate-fade-in">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por razão social, CNPJ..."
              className="pl-9 input-focus-ring"
            />
          </div>
          <Button className="btn-gradient">
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">42</p>
              <p className="text-xs text-muted-foreground">Total de Empresas</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">38</p>
              <p className="text-xs text-muted-foreground">Cert. Válidos</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">3</p>
              <p className="text-xs text-muted-foreground">Expirando</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">1</p>
              <p className="text-xs text-muted-foreground">Sem Certificado</p>
            </div>
          </div>
        </div>

        {/* Companies table */}
        <div className="card-elevated">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Empresa
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    CNPJ
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Regime
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Certificado
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Ambiente
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    NFC-e Hoje
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="table-row-interactive">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{empresa.nomeFantasia}</p>
                          <p className="text-xs text-muted-foreground">{empresa.razaoSocial}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-mono text-foreground">{empresa.cnpj}</p>
                        <p className="text-xs text-muted-foreground">{empresa.uf}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-foreground">{regimeLabels[empresa.regime]}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className={cn("status-badge", certificadoStyles[empresa.certificadoStatus].class)}>
                          {certificadoStyles[empresa.certificadoStatus].label}
                        </span>
                        {empresa.certificadoVencimento && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Vence: {new Date(empresa.certificadoVencimento).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-sm",
                        empresa.ambiente === "producao" ? "text-success" : "text-warning"
                      )}>
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          empresa.ambiente === "producao" ? "bg-success" : "bg-warning"
                        )} />
                        {empresa.ambiente === "producao" ? "Produção" : "Homologação"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {empresa.nfceHoje.toLocaleString("pt-BR")}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Configurações NFC-e
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Certificado Digital
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
