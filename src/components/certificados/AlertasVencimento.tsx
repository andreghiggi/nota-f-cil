import { AlertTriangle, Bell, XCircle, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Certificado {
  id: string;
  status: string;
  data_vencimento: string;
  empresas: { nome_fantasia: string | null; cnpj: string } | null;
}

interface AlertasVencimentoProps {
  certificados: Certificado[];
  onRenovar?: (id: string) => void;
}

export function AlertasVencimento({ certificados, onRenovar }: AlertasVencimentoProps) {
  const getDiasRestantes = (dataVencimento: string) => {
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    return Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Filter certificates expiring soon (within 30 days) or already expired
  const alertas = certificados
    ?.filter(cert => {
      const diasRestantes = getDiasRestantes(cert.data_vencimento);
      return diasRestantes <= 30;
    })
    .sort((a, b) => getDiasRestantes(a.data_vencimento) - getDiasRestantes(b.data_vencimento)) || [];

  const expirados = alertas.filter(c => getDiasRestantes(c.data_vencimento) <= 0);
  const criticos = alertas.filter(c => {
    const dias = getDiasRestantes(c.data_vencimento);
    return dias > 0 && dias <= 7;
  });
  const atencao = alertas.filter(c => {
    const dias = getDiasRestantes(c.data_vencimento);
    return dias > 7 && dias <= 30;
  });

  if (alertas.length === 0) {
    return (
      <div className="card-elevated p-6 border-l-4 border-l-success">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Tudo em ordem!</h3>
            <p className="text-sm text-muted-foreground">
              Nenhum certificado próximo do vencimento
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">
            Alertas de Vencimento
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {alertas.length} {alertas.length === 1 ? 'certificado requer atenção' : 'certificados requerem atenção'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {expirados.length > 0 && (
          <div className="card-elevated p-4 border-l-4 border-l-destructive bg-destructive/5">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{expirados.length}</p>
                <p className="text-xs text-muted-foreground">Expirados</p>
              </div>
            </div>
          </div>
        )}
        {criticos.length > 0 && (
          <div className="card-elevated p-4 border-l-4 border-l-warning bg-warning/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{criticos.length}</p>
                <p className="text-xs text-muted-foreground">Críticos (≤7 dias)</p>
              </div>
            </div>
          </div>
        )}
        {atencao.length > 0 && (
          <div className="card-elevated p-4 border-l-4 border-l-info bg-info/5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-info" />
              <div>
                <p className="text-2xl font-bold text-info">{atencao.length}</p>
                <p className="text-xs text-muted-foreground">Atenção (≤30 dias)</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de alertas */}
      <div className="card-elevated divide-y divide-border overflow-hidden">
        {alertas.map((cert) => {
          const diasRestantes = getDiasRestantes(cert.data_vencimento);
          const isExpirado = diasRestantes <= 0;
          const isCritico = diasRestantes > 0 && diasRestantes <= 7;
          
          return (
            <div 
              key={cert.id} 
              className={cn(
                "p-4 flex items-center justify-between gap-4 transition-colors",
                isExpirado && "bg-destructive/5",
                isCritico && !isExpirado && "bg-warning/5"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  isExpirado ? "bg-destructive/10" : isCritico ? "bg-warning/10" : "bg-info/10"
                )}>
                  {isExpirado ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : isCritico ? (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  ) : (
                    <Clock className="h-5 w-5 text-info" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {cert.empresas?.nome_fantasia || 'Empresa'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    CNPJ: {cert.empresas?.cnpj || '-'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    isExpirado ? "text-destructive" : isCritico ? "text-warning" : "text-info"
                  )}>
                    {isExpirado 
                      ? `Expirado há ${Math.abs(diasRestantes)} dias`
                      : `${diasRestantes} dias restantes`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vence em {new Date(cert.data_vencimento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onRenovar?.(cert.id)}
                  className={cn(
                    isExpirado && "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
                    isCritico && !isExpirado && "border-warning text-warning hover:bg-warning hover:text-warning-foreground"
                  )}
                >
                  Renovar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
