import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Upload, 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle,
  CheckCircle2,
  Calendar,
  Building2,
  MoreHorizontal,
  Download,
  Trash2,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Certificado {
  id: string;
  empresa: string;
  cnpj: string;
  tipo: "A1";
  emissor: string;
  dataEmissao: string;
  dataVencimento: string;
  status: "valido" | "expirando" | "expirado";
  diasRestantes: number;
}

const certificados: Certificado[] = [
  {
    id: "1",
    empresa: "Loja Centro Ltda",
    cnpj: "12.345.678/0001-90",
    tipo: "A1",
    emissor: "AC VALID RFB",
    dataEmissao: "2023-06-15",
    dataVencimento: "2025-06-15",
    status: "valido",
    diasRestantes: 517,
  },
  {
    id: "2",
    empresa: "Supermercado ABC S.A.",
    cnpj: "98.765.432/0001-10",
    tipo: "A1",
    emissor: "AC SERASA RFB",
    dataEmissao: "2023-02-28",
    dataVencimento: "2024-02-28",
    status: "expirando",
    diasRestantes: 44,
  },
  {
    id: "3",
    empresa: "Farmácia Popular Ltda",
    cnpj: "11.222.333/0001-44",
    tipo: "A1",
    emissor: "AC CERTISIGN RFB",
    dataEmissao: "2023-01-10",
    dataVencimento: "2024-01-10",
    status: "expirado",
    diasRestantes: -5,
  },
  {
    id: "4",
    empresa: "Padaria do Zé ME",
    cnpj: "55.666.777/0001-88",
    tipo: "A1",
    emissor: "AC VALID RFB",
    dataEmissao: "2023-03-20",
    dataVencimento: "2025-03-20",
    status: "valido",
    diasRestantes: 430,
  },
];

const statusConfig = {
  valido: {
    label: "Válido",
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  expirando: {
    label: "Expirando",
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  expirado: {
    label: "Expirado",
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export default function Certificados() {
  const getProgressValue = (diasRestantes: number) => {
    const totalDias = 365;
    if (diasRestantes <= 0) return 0;
    return Math.min((diasRestantes / totalDias) * 100, 100);
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "valido":
        return "bg-success";
      case "expirando":
        return "bg-warning";
      case "expirado":
        return "bg-destructive";
      default:
        return "bg-primary";
    }
  };

  return (
    <AppLayout title="Certificados Digitais" subtitle="Gestão de certificados A1 das empresas">
      <div className="space-y-6 animate-fade-in">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, CNPJ..."
              className="pl-9 input-focus-ring"
            />
          </div>
          <Button className="btn-gradient">
            <Upload className="h-4 w-4 mr-2" />
            Upload Certificado
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">42</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">38</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
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
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">1</p>
              <p className="text-xs text-muted-foreground">Expirados</p>
            </div>
          </div>
        </div>

        {/* Certificates grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {certificados.map((cert) => {
            const status = statusConfig[cert.status];
            const StatusIcon = status.icon;
            
            return (
              <div key={cert.id} className="card-elevated p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{cert.empresa}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{cert.cnpj}</p>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium", status.bgColor, status.color)}>
                    <StatusIcon className="h-4 w-4" />
                    {status.label}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                    <p className="text-sm font-medium text-foreground">Certificado {cert.tipo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Emissor</p>
                    <p className="text-sm font-medium text-foreground">{cert.emissor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Emissão</p>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(cert.dataEmissao).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                    <p className={cn("text-sm font-medium flex items-center gap-1.5", status.color)}>
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(cert.dataVencimento).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Validade restante</span>
                    <span className={cn("font-medium", status.color)}>
                      {cert.diasRestantes > 0 ? `${cert.diasRestantes} dias` : "Expirado"}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", getProgressColor(cert.status))}
                      style={{ width: `${getProgressValue(cert.diasRestantes)}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    Detalhes
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Upload className="h-4 w-4 mr-2" />
                        Substituir
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload instructions */}
        <div className="card-elevated p-6 border-dashed border-2">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Upload de Certificado Digital A1
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Arraste o arquivo .pfx ou clique para selecionar. O certificado será validado automaticamente e vinculado à empresa correspondente.
            </p>
            <Button variant="outline">
              Selecionar arquivo .pfx
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
