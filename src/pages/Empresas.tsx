import { useState } from "react";
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
  Settings,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { useEmpresas, useCertificados, useDeleteEmpresa, Empresa } from "@/hooks/useSupabaseData";
import { EmpresaFormDialog } from "@/components/empresas/EmpresaFormDialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const regimeLabels = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

const certificadoStyles = {
  valido: { label: "Válido", class: "status-autorizada" },
  expirando: { label: "Expirando", class: "status-processando" },
  expirado: { label: "Expirado", class: "status-rejeitada" },
  pendente: { label: "Pendente", class: "status-cancelada" },
  sem_certificado: { label: "Sem Certificado", class: "status-cancelada" },
};

export default function Empresas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [deleteEmpresaId, setDeleteEmpresaId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { data: empresas, isLoading, refetch } = useEmpresas();
  const { data: certificados } = useCertificados();
  const deleteEmpresa = useDeleteEmpresa();
  const navigate = useNavigate();

  const filteredEmpresas = empresas?.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.razao_social.toLowerCase().includes(searchLower) ||
      emp.nome_fantasia?.toLowerCase().includes(searchLower) ||
      emp.cnpj.includes(searchTerm.replace(/\D/g, ''))
    );
  });

  const getCertificadoInfo = (empresaId: string) => {
    const cert = certificados?.find(c => c.empresa_id === empresaId);
    if (!cert) return { status: 'sem_certificado', vencimento: null };
    return {
      status: cert.status,
      vencimento: cert.data_vencimento
    };
  };

  const stats = {
    total: empresas?.length || 0,
    certValidos: certificados?.filter(c => c.status === 'valido').length || 0,
    certExpirando: certificados?.filter(c => c.status === 'expirando').length || 0,
    semCertificado: (empresas?.length || 0) - (certificados?.length || 0),
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const handleEdit = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteEmpresaId) return;
    
    setIsDeleting(true);
    try {
      await deleteEmpresa.mutateAsync(deleteEmpresaId);
      toast.success("Empresa excluída com sucesso");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao excluir empresa: " + error.message);
    } finally {
      setIsDeleting(false);
      setDeleteEmpresaId(null);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedEmpresa(null);
  };

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button className="btn-gradient" onClick={() => setFormOpen(true)}>
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
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total de Empresas</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.certValidos}</p>
              <p className="text-xs text-muted-foreground">Cert. Válidos</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.certExpirando}</p>
              <p className="text-xs text-muted-foreground">Expirando</p>
            </div>
          </div>
          <div className="card-elevated p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.semCertificado}</p>
              <p className="text-xs text-muted-foreground">Sem Certificado</p>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="card-elevated p-12 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!filteredEmpresas || filteredEmpresas.length === 0) && (
          <div className="card-elevated p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente ajustar os termos da busca" 
                : "Cadastre sua primeira empresa para começar"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            )}
          </div>
        )}

        {/* Companies table */}
        {!isLoading && filteredEmpresas && filteredEmpresas.length > 0 && (
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
                      Série
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmpresas.map((empresa) => {
                    const certInfo = getCertificadoInfo(empresa.id);
                    const certStyle = certificadoStyles[certInfo.status as keyof typeof certificadoStyles] || certificadoStyles.sem_certificado;
                    
                    return (
                      <tr key={empresa.id} className="table-row-interactive">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {empresa.nome_fantasia || empresa.razao_social}
                              </p>
                              <p className="text-xs text-muted-foreground">{empresa.razao_social}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-mono text-foreground">{formatCNPJ(empresa.cnpj)}</p>
                            <p className="text-xs text-muted-foreground">{empresa.uf}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-foreground">{regimeLabels[empresa.regime_tributario]}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <span className={cn("status-badge", certStyle.class)}>
                              {certStyle.label}
                            </span>
                            {certInfo.vencimento && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Vence: {new Date(certInfo.vencimento).toLocaleDateString("pt-BR")}
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
                          <p className="text-sm font-mono text-foreground">{empresa.serie_nfce}</p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(empresa)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate('/certificados')}>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Certificado Digital
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate('/tokens')}>
                                <Settings className="h-4 w-4 mr-2" />
                                Tokens API
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteEmpresaId(empresa.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <EmpresaFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        empresa={selectedEmpresa}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEmpresaId} onOpenChange={() => setDeleteEmpresaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta empresa? Esta ação removerá também todos os tokens, 
              certificados e NFC-e associados. Esta ação não pode ser desfeita.
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
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
