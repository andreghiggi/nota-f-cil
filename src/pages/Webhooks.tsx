import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Webhook as WebhookIcon, 
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ExternalLink
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWebhooks, useEmpresas, useUpdateWebhook, useDeleteWebhook, useWebhookLogs } from "@/hooks/useSupabaseData";
import { WebhookFormDialog } from "@/components/webhooks/WebhookFormDialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const eventLabels: Record<string, string> = {
  "nfce.autorizada": "Autorizada",
  "nfce.rejeitada": "Rejeitada",
  "nfce.cancelada": "Cancelada",
  "nfce.denegada": "Denegada",
};

export default function Webhooks() {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [logsWebhookId, setLogsWebhookId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: webhooks, isLoading, refetch } = useWebhooks();
  const { data: empresas } = useEmpresas();
  const { data: logs, isLoading: logsLoading } = useWebhookLogs(logsWebhookId || undefined);
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const getEmpresaNome = (empresaId: string) => {
    const empresa = empresas?.find(e => e.id === empresaId);
    return empresa?.nome_fantasia || empresa?.razao_social || "Empresa";
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      await updateWebhook.mutateAsync({ id, ativo: !ativo });
      toast.success(ativo ? "Webhook desativado" : "Webhook ativado");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar webhook");
    }
  };

  const handleDelete = async () => {
    if (!deleteWebhookId) return;
    
    setIsDeleting(true);
    try {
      await deleteWebhook.mutateAsync(deleteWebhookId);
      toast.success("Webhook excluído com sucesso");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao excluir webhook");
    } finally {
      setIsDeleting(false);
      setDeleteWebhookId(null);
    }
  };

  const activeCount = webhooks?.filter(w => w.ativo).length || 0;

  return (
    <AppLayout title="Webhooks" subtitle="Configure notificações automáticas para ERPs externos">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="card-elevated p-4 flex items-center gap-4 flex-1 mr-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <WebhookIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Webhooks ativos</p>
              <p className="text-2xl font-bold text-foreground">{activeCount} / {webhooks?.length || 0}</p>
            </div>
          </div>
          
          <Button className="btn-gradient" onClick={() => setFormOpen(true)} disabled={!empresas?.length}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Webhook
          </Button>
        </div>

        {/* Info box */}
        <div className="card-elevated p-4 bg-info/5 border-info/20">
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
              <WebhookIcon className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sobre Webhooks</p>
              <p className="text-sm text-muted-foreground mt-1">
                Webhooks enviam notificações HTTP POST para seu sistema quando eventos ocorrem. 
                Cada requisição inclui uma assinatura HMAC-SHA256 para validação.
                <Link to="/docs" className="text-primary hover:underline ml-1 inline-flex items-center gap-1">
                  Ver documentação
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* No empresas warning */}
        {!isLoading && (!empresas || empresas.length === 0) && (
          <div className="card-elevated p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Você precisa cadastrar pelo menos uma empresa antes de criar webhooks.
            </p>
            <Button variant="outline" asChild>
              <Link to="/empresas">Ir para Empresas</Link>
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="card-elevated p-12 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && empresas?.length && (!webhooks || webhooks.length === 0) && (
          <div className="card-elevated p-12 text-center">
            <WebhookIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum webhook configurado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure webhooks para receber notificações automáticas em seu ERP.
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Webhook
            </Button>
          </div>
        )}

        {/* Webhooks list */}
        {!isLoading && webhooks && webhooks.length > 0 && (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="card-elevated p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      webhook.ativo ? "bg-primary/10" : "bg-muted"
                    )}>
                      <WebhookIcon className={cn("h-5 w-5", webhook.ativo ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{webhook.nome}</h3>
                      <p className="text-sm text-muted-foreground">{getEmpresaNome(webhook.empresa_id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={webhook.ativo}
                      onCheckedChange={() => handleToggleAtivo(webhook.id, webhook.ativo)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLogsWebhookId(webhook.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Logs
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteWebhookId(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1.5">URL do Endpoint</p>
                  <code className="bg-muted px-3 py-2 rounded-md text-sm font-mono text-foreground block truncate">
                    {webhook.url}
                  </code>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Eventos</p>
                    <div className="flex flex-wrap gap-1">
                      {webhook.eventos.map((evento) => (
                        <Badge key={evento} variant="secondary" className="text-xs">
                          {eventLabels[evento] || evento}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Último envio</p>
                    <p className="text-sm font-medium text-foreground">
                      {webhook.ultimo_envio 
                        ? new Date(webhook.ultimo_envio).toLocaleString("pt-BR")
                        : "Nunca"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Último status</p>
                    <div className="flex items-center gap-1.5">
                      {webhook.ultimo_status ? (
                        webhook.ultimo_status < 400 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium text-success">{webhook.ultimo_status}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-medium text-destructive">{webhook.ultimo_status}</span>
                          </>
                        )
                      ) : (
                        <>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">-</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Falhas consecutivas</p>
                    <p className={cn(
                      "text-sm font-medium",
                      webhook.falhas_consecutivas > 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {webhook.falhas_consecutivas}
                    </p>
                  </div>
                </div>

                {webhook.falhas_consecutivas >= 5 && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                      {webhook.falhas_consecutivas >= 10 
                        ? "Webhook desativado automaticamente após 10 falhas consecutivas."
                        : `Atenção: ${webhook.falhas_consecutivas} falhas consecutivas. O webhook será desativado após 10 falhas.`
                      }
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={() => setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este webhook? Esta ação não pode ser desfeita.
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

      {/* Logs Dialog */}
      <Dialog open={!!logsWebhookId} onOpenChange={() => setLogsWebhookId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs de Entrega</DialogTitle>
            <DialogDescription>
              Histórico das últimas 50 tentativas de entrega deste webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {logsLoading && (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              </div>
            )}

            {!logsLoading && (!logs || logs.length === 0) && (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum log encontrado
              </div>
            )}

            {logs?.map((log: any) => (
              <div 
                key={log.id} 
                className={cn(
                  "p-3 rounded-lg border",
                  log.sucesso ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {log.sucesso ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant="outline">{log.evento}</Badge>
                    {log.status_code && (
                      <span className={cn(
                        "text-sm font-mono",
                        log.sucesso ? "text-success" : "text-destructive"
                      )}>
                        HTTP {log.status_code}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {log.erro && (
                  <p className="text-sm text-destructive mt-1">{log.erro}</p>
                )}
                {log.duracao_ms && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo de resposta: {log.duracao_ms}ms
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
