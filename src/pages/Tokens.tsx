import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useTokensAPI, useEmpresas, useCreateToken } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const permissoesDisponiveis = [
  { id: "emitir_nfce", label: "Emitir NFC-e", description: "Permite criar novas NFC-e" },
  { id: "emitir_nfe", label: "Emitir NF-e", description: "Permite criar novas NF-e" },
  { id: "consultar", label: "Consultar", description: "Permite consultar status e listar documentos fiscais" },
  { id: "cancelar", label: "Cancelar", description: "Permite cancelar NFC-e e NF-e autorizadas" },
  { id: "reprocessar", label: "Reprocessar", description: "Permite reprocessar documentos rejeitados" },
];

const statusConfig = {
  ativo: {
    label: "Ativo",
    icon: CheckCircle2,
    class: "status-autorizada",
  },
  inativo: {
    label: "Inativo",
    icon: Clock,
    class: "status-cancelada",
  },
  revogado: {
    label: "Revogado",
    icon: AlertTriangle,
    class: "status-rejeitada",
  },
};

export default function Tokens() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedPermissoes, setSelectedPermissoes] = useState<string[]>(["emitir_nfce", "emitir_nfe", "consultar"]);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [deleteTokenId, setDeleteTokenId] = useState<string | null>(null);

  const { data: tokens, isLoading: tokensLoading } = useTokensAPI();
  const { data: empresas, isLoading: empresasLoading } = useEmpresas();
  const createToken = useCreateToken();
  const queryClient = useQueryClient();

  const handleCreateToken = async () => {
    if (!newTokenName.trim() || !selectedEmpresa || selectedPermissoes.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const result = await createToken.mutateAsync({
        empresaId: selectedEmpresa,
        nome: newTokenName,
        permissoes: selectedPermissoes
      });

      setGeneratedToken(result.full_token);
      toast.success("Token criado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao criar token: " + error.message);
    }
  };

  const handleCloseCreateDialog = () => {
    setIsCreateOpen(false);
    setNewTokenName("");
    setSelectedEmpresa("");
    setSelectedPermissoes(["emitir_nfce", "emitir_nfe", "consultar"]);
    setGeneratedToken(null);
    setTokenCopied(false);
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setTokenCopied(true);
    toast.success("Token copiado para a área de transferência");
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleToggleStatus = async (tokenId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    
    const { error } = await supabase
      .from('tokens_api')
      .update({ status: newStatus })
      .eq('id', tokenId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Token ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
      queryClient.invalidateQueries({ queryKey: ['tokens-api'] });
    }
  };

  const handleDeleteToken = async () => {
    if (!deleteTokenId) return;

    const { error } = await supabase
      .from('tokens_api')
      .delete()
      .eq('id', deleteTokenId);

    if (error) {
      toast.error("Erro ao excluir token");
    } else {
      toast.success("Token excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ['tokens-api'] });
    }
    setDeleteTokenId(null);
  };

  const togglePermissao = (permissao: string) => {
    setSelectedPermissoes(prev => 
      prev.includes(permissao) 
        ? prev.filter(p => p !== permissao)
        : [...prev, permissao]
    );
  };

  const getEmpresaNome = (empresaId: string) => {
    const empresa = empresas?.find(e => e.id === empresaId);
    return empresa?.nome_fantasia || empresa?.razao_social || "Empresa não encontrada";
  };

  const activeTokensCount = tokens?.filter(t => t.status === 'ativo').length || 0;
  const totalTokensCount = tokens?.length || 0;

  return (
    <AppLayout title="Tokens API" subtitle="Gerencie as chaves de API para integração com ERPs">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="card-elevated p-4 flex items-center gap-4 flex-1 mr-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tokens ativos</p>
              <p className="text-2xl font-bold text-foreground">{activeTokensCount} / {totalTokensCount}</p>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient" disabled={!empresas?.length}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Token
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              {!generatedToken ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Token API</DialogTitle>
                    <DialogDescription>
                      Crie um token para permitir que um ERP se conecte à API de emissão de NF-e e NFC-e.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Token</Label>
                      <Input
                        id="nome"
                        placeholder="Ex: ERP Principal, PDV Loja 01"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Empresa</Label>
                      <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas?.map((empresa) => (
                            <SelectItem key={empresa.id} value={empresa.id}>
                              {empresa.nome_fantasia || empresa.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Permissões</Label>
                      <div className="space-y-2">
                        {permissoesDisponiveis.map((perm) => (
                          <div
                            key={perm.id}
                            className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={perm.id}
                              checked={selectedPermissoes.includes(perm.id)}
                              onCheckedChange={() => togglePermissao(perm.id)}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={perm.id}
                                className="text-sm font-medium text-foreground cursor-pointer"
                              >
                                {perm.label}
                              </label>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreateDialog}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateToken} 
                      disabled={createToken.isPending}
                      className="btn-gradient"
                    >
                      {createToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Token
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      Token Criado com Sucesso!
                    </DialogTitle>
                    <DialogDescription>
                      Copie o token abaixo. Por segurança, ele não será exibido novamente.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4">
                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg mb-4">
                      <p className="text-sm text-warning font-medium">
                        ⚠️ Atenção: Guarde este token em local seguro!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Este é o único momento em que você poderá ver o token completo.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Seu Token API</Label>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono text-foreground break-all">
                          {generatedToken}
                        </code>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => copyToken(generatedToken)}
                        >
                          {tokenCopied ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={handleCloseCreateDialog}>
                      Fechar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Info box */}
        <div className="card-elevated p-4 bg-info/5 border-info/20">
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
              <Key className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sobre os Tokens de API</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use estes tokens para autenticar requisições à API de emissão de NF-e e NFC-e. 
                Cada token é vinculado a uma empresa e tem permissões específicas.
                <Link to="/docs" className="text-primary hover:underline ml-1 inline-flex items-center gap-1">
                  Ver documentação da API
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* No empresas warning */}
        {!empresasLoading && (!empresas || empresas.length === 0) && (
          <div className="card-elevated p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Você precisa cadastrar pelo menos uma empresa antes de criar tokens de API.
            </p>
            <Button variant="outline" asChild>
              <Link to="/empresas">Ir para Empresas</Link>
            </Button>
          </div>
        )}

        {/* Tokens list */}
        {tokensLoading ? (
          <div className="card-elevated p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando tokens...</p>
          </div>
        ) : tokens && tokens.length > 0 ? (
          <div className="space-y-4">
            {tokens.map((token) => {
              const status = statusConfig[token.status as keyof typeof statusConfig] || statusConfig.ativo;
              
              return (
                <div key={token.id} className="card-elevated p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{token.nome}</h3>
                        <p className="text-sm text-muted-foreground">{getEmpresaNome(token.empresa_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("status-badge", status.class)}>
                        {status.label}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleStatus(token.id, token.status)}>
                            {token.status === 'ativo' ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeleteTokenId(token.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1.5">Prefixo do Token</p>
                    <code className="bg-muted px-3 py-2 rounded-md text-sm font-mono text-foreground">
                      {token.token_prefix}••••••••••••••••
                    </code>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(token.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {token.ultimo_uso && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Último uso</p>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(token.ultimo_uso).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    )}
                    {token.ip_ultimo_uso && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">IP último uso</p>
                        <p className="text-sm font-mono text-foreground">
                          {token.ip_ultimo_uso}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Permissões</p>
                    <div className="flex flex-wrap gap-2">
                      {token.permissoes.map((perm) => {
                        const permInfo = permissoesDisponiveis.find(p => p.id === perm);
                        return (
                          <span 
                            key={perm} 
                            className="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-md"
                          >
                            {permInfo?.label || perm}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : empresas && empresas.length > 0 ? (
          <div className="card-elevated p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Key className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              Nenhum token criado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro token de API para começar a integrar com ERPs.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="btn-gradient">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Token
            </Button>
          </div>
        ) : null}

        {/* API Documentation link */}
        <div className="card-elevated p-6 text-center">
          <h3 className="text-base font-semibold text-foreground mb-2">Documentação da API</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Acesse nossa documentação completa para integrar seu ERP ou PDV com a plataforma de emissão de NFC-e.
          </p>
          <Button variant="outline" asChild>
            <Link to="/docs">Ver Documentação</Link>
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTokenId} onOpenChange={() => setDeleteTokenId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Token</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este token? Esta ação não pode ser desfeita 
                e o ERP que utiliza este token perderá o acesso à API imediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteToken}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
