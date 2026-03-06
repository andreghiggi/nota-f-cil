import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Trash2, Loader2, Edit2, Check, X, 
  FileText, ShoppingCart 
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  useSeriesFiscais, 
  useCreateSerieFiscal, 
  useUpdateSerieFiscal, 
  useDeleteSerieFiscal,
  SerieFiscal 
} from "@/hooks/useSupabaseData";
import { cn } from "@/lib/utils";

interface SeriesFiscaisManagerProps {
  empresaId: string;
  tipo: 'nfe' | 'nfce';
}

export function SeriesFiscaisManager({ empresaId, tipo }: SeriesFiscaisManagerProps) {
  const { data: allSeries, isLoading } = useSeriesFiscais(empresaId);
  const createSerie = useCreateSerieFiscal();
  const updateSerie = useUpdateSerieFiscal();
  const deleteSerie = useDeleteSerieFiscal();

  const [newSerie, setNewSerie] = useState("");
  const [newNumero, setNewNumero] = useState("0");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const series = allSeries?.filter(s => s.tipo === tipo) || [];
  const label = tipo === 'nfe' ? 'NF-e' : 'NFC-e';
  const Icon = tipo === 'nfe' ? FileText : ShoppingCart;

  const handleAdd = async () => {
    const serieFormatted = newSerie.padStart(3, '0');
    if (!serieFormatted || serieFormatted === '000') {
      toast.error("Informe um número de série válido");
      return;
    }
    if (series.some(s => s.serie === serieFormatted)) {
      toast.error(`Série ${serieFormatted} já existe para ${label}`);
      return;
    }
    try {
      await createSerie.mutateAsync({
        empresa_id: empresaId,
        tipo,
        serie: serieFormatted,
        numero_atual: parseInt(newNumero) || 0,
      });
      toast.success(`Série ${serieFormatted} adicionada`);
      setNewSerie("");
      setNewNumero("0");
      setShowAdd(false);
    } catch (err: any) {
      toast.error("Erro ao criar série: " + err.message);
    }
  };

  const handleUpdateNumero = async (id: string) => {
    const num = parseInt(editNumero);
    if (isNaN(num) || num < 0) {
      toast.error("Número inválido");
      return;
    }
    try {
      await updateSerie.mutateAsync({ id, numero_atual: num });
      toast.success("Número atualizado");
      setEditingId(null);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleToggleAtivo = async (serie: SerieFiscal) => {
    try {
      await updateSerie.mutateAsync({ id: serie.id, ativo: !serie.ativo });
      toast.success(serie.ativo ? "Série desativada" : "Série ativada");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSerie.mutateAsync(deleteId);
      toast.success("Série excluída");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          Séries {label}
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova Série
        </Button>
      </div>

      {/* Add new series form */}
      {showAdd && (
        <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Série</label>
              <Input
                placeholder="001"
                maxLength={3}
                value={newSerie}
                onChange={(e) => setNewSerie(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Próximo Número</label>
              <Input
                placeholder="0"
                value={newNumero}
                onChange={(e) => setNewNumero(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={createSerie.isPending}
            >
              {createSerie.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Series list */}
      {series.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma série cadastrada. Clique em "Nova Série" para adicionar.
        </p>
      )}

      <div className="space-y-2">
        {series.map((serie) => (
          <div
            key={serie.id}
            className={cn(
              "flex items-center gap-3 p-3 border rounded-lg transition-colors",
              serie.ativo ? "border-border bg-background" : "border-border/50 bg-muted/20 opacity-60"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium text-foreground">
                  Série {serie.serie}
                </span>
                <Badge variant={serie.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {serie.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {editingId === serie.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Próx. nº:</span>
                    <Input
                      className="h-6 w-24 text-xs px-1"
                      value={editNumero}
                      onChange={(e) => setEditNumero(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateNumero(serie.id)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleUpdateNumero(serie.id)}
                      disabled={updateSerie.isPending}
                    >
                      <Check className="h-3 w-3 text-success" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Próximo número: <strong className="text-foreground">{serie.numero_atual + 1}</strong>
                    {" "}(último emitido: {serie.numero_atual})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {editingId !== serie.id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditingId(serie.id);
                    setEditNumero(serie.numero_atual.toString());
                  }}
                  title="Editar número"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Switch
                checked={serie.ativo}
                onCheckedChange={() => handleToggleAtivo(serie)}
                className="scale-75"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(serie.id)}
                title="Excluir série"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Série</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? O histórico de numeração será perdido. Notas já emitidas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
