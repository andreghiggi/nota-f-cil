import { useState } from "react";
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
  MoreHorizontal,
  Download,
  Trash2,
  Eye,
  Loader2,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCertificados } from "@/hooks/useSupabaseData";
import { CertificadoUploadDialog } from "@/components/certificados/CertificadoUploadDialog";
import { AlertasVencimento } from "@/components/certificados/AlertasVencimento";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  pendente: {
    label: "Pendente",
    icon: RefreshCw,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

export default function Certificados() {
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [certificadoToDelete, setCertificadoToDelete] = useState<{ id: string; arquivoPath: string | null } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: certificados, isLoading, refetch } = useCertificados();
  const queryClient = useQueryClient();

  const filteredCertificados = certificados?.filter(cert => {
    const searchLower = searchTerm.toLowerCase();
    const empresa = cert.empresas as { nome_fantasia: string | null; cnpj: string } | null;
    return (
      empresa?.nome_fantasia?.toLowerCase().includes(searchLower) ||
      empresa?.cnpj.includes(searchTerm) ||
      cert.cnpj_certificado?.includes(searchTerm)
    );
  });

  const stats = {
    total: certificados?.length || 0,
    validos: certificados?.filter(c => c.status === 'valido').length || 0,
    expirando: certificados?.filter(c => c.status === 'expirando').length || 0,
    expirados: certificados?.filter(c => c.status === 'expirado').length || 0,
  };

  const getDiasRestantes = (dataVencimento: string) => {
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    return Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  };

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

  const handleDelete = async () => {
    if (!certificadoToDelete) return;

    setIsDeleting(true);
    try {
      // Delete file from storage if exists
      if (certificadoToDelete.arquivoPath) {
        await supabase.storage
          .from('certificados')
          .remove([certificadoToDelete.arquivoPath]);
      }

      // Delete record from database
      const { error } = await supabase
        .from('certificados_digitais')
        .delete()
        .eq('id', certificadoToDelete.id);

      if (error) throw error;

      toast.success("Certificado removido com sucesso");
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
    } catch (error: any) {
      toast.error("Erro ao remover certificado: " + error.message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCertificadoToDelete(null);
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button className="btn-gradient" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Certificado
          </Button>
        </div>

        {/* Alertas de Vencimento */}
        {certificados && certificados.length > 0 && (
          <AlertasVencimento 
            certificados={certificados.map(c => ({
              ...c,
              empresas: c.empresas as { nome_fantasia: string | null; cnpj: string } | null
            }))}
            onRenovar={() => setUploadDialogOpen(true)}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.validos}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.expirando}</p>
              <p className="text-xs text-muted-foreground">Expirando</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.expirados}</p>
              <p className="text-xs text-muted-foreground">Expirados</p>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!filteredCertificados || filteredCertificados.length === 0) && (
          <div className="card-elevated p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? "Nenhum certificado encontrado" : "Nenhum certificado cadastrado"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente ajustar os termos da busca" 
                : "Faça upload do primeiro certificado digital A1"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Certificado
              </Button>
            )}
          </div>
        )}

        {/* Certificates grid */}
        {!isLoading && filteredCertificados && filteredCertificados.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCertificados.map((cert) => {
              const status = statusConfig[cert.status] || statusConfig.pendente;
              const StatusIcon = status.icon;
              const empresa = cert.empresas as { nome_fantasia: string | null; cnpj: string } | null;
              const diasRestantes = getDiasRestantes(cert.data_vencimento);
              
              return (
                <div key={cert.id} className="card-elevated p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          {empresa?.nome_fantasia || 'Empresa'}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {empresa?.cnpj || cert.cnpj_certificado || '-'}
                        </p>
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
                      <p className="text-sm font-medium text-foreground">{cert.emissor || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Emissão</p>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {cert.data_emissao 
                          ? new Date(cert.data_emissao).toLocaleDateString("pt-BR")
                          : '-'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                      <p className={cn("text-sm font-medium flex items-center gap-1.5", status.color)}>
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(cert.data_vencimento).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Validade restante</span>
                      <span className={cn("font-medium", status.color)}>
                        {diasRestantes > 0 ? `${diasRestantes} dias` : "Expirado"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", getProgressColor(cert.status))}
                        style={{ width: `${getProgressValue(diasRestantes)}%` }}
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
                        <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Substituir
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setCertificadoToDelete({ id: cert.id, arquivoPath: cert.arquivo_path });
                            setDeleteDialogOpen(true);
                          }}
                        >
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
        )}

        {/* Upload instructions */}
        <div 
          className="card-elevated p-6 border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setUploadDialogOpen(true)}
        >
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

      {/* Upload Dialog */}
      <CertificadoUploadDialog 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Certificado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este certificado? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
