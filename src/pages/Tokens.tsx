import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Token {
  id: string;
  nome: string;
  token: string;
  empresa: string;
  status: "ativo" | "inativo" | "expirado";
  ultimoUso?: string;
  criadoEm: string;
  expiraEm?: string;
  permissoes: string[];
}

const tokens: Token[] = [
  {
    id: "1",
    nome: "ERP Principal",
    token: "nfce_live_sk_1a2b3c4d5e6f7g8h9i0j",
    empresa: "Loja Centro Ltda",
    status: "ativo",
    ultimoUso: "2024-01-15 14:32:00",
    criadoEm: "2023-06-15",
    permissoes: ["emitir", "consultar", "cancelar"],
  },
  {
    id: "2",
    nome: "PDV Filial 01",
    token: "nfce_live_sk_9k8l7m6n5o4p3q2r1s0t",
    empresa: "Supermercado ABC",
    status: "ativo",
    ultimoUso: "2024-01-15 14:28:00",
    criadoEm: "2023-08-20",
    permissoes: ["emitir", "consultar"],
  },
  {
    id: "3",
    nome: "Sistema Legado",
    token: "nfce_test_sk_abc123def456ghi789",
    empresa: "Farmácia Popular",
    status: "inativo",
    criadoEm: "2023-03-10",
    permissoes: ["emitir", "consultar", "cancelar", "reprocessar"],
  },
  {
    id: "4",
    nome: "Integração Teste",
    token: "nfce_test_sk_xyz789uvw456rst123",
    empresa: "Tech Store",
    status: "expirado",
    criadoEm: "2023-01-01",
    expiraEm: "2024-01-01",
    permissoes: ["consultar"],
  },
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
  expirado: {
    label: "Expirado",
    icon: AlertTriangle,
    class: "status-rejeitada",
  },
};

const permissaoLabels: Record<string, string> = {
  emitir: "Emitir",
  consultar: "Consultar",
  cancelar: "Cancelar",
  reprocessar: "Reprocessar",
};

export default function Tokens() {
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  const toggleTokenVisibility = (id: string) => {
    const newVisible = new Set(visibleTokens);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleTokens(newVisible);
  };

  const maskToken = (token: string) => {
    return token.substring(0, 12) + "••••••••••••••••";
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
  };

  return (
    <AppLayout title="Tokens API" subtitle="Gerencie as chaves de API para integração">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="card-elevated p-4 flex items-center gap-4 flex-1 mr-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tokens ativos</p>
              <p className="text-2xl font-bold text-foreground">2 / 4</p>
            </div>
          </div>
          <Button className="btn-gradient">
            <Plus className="h-4 w-4 mr-2" />
            Novo Token
          </Button>
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
                Use estes tokens para autenticar requisições à API de emissão de NFC-e. 
                Nunca compartilhe seus tokens e mantenha-os seguros. 
                Cada token pode ser configurado com permissões específicas.
              </p>
            </div>
          </div>
        </div>

        {/* Tokens list */}
        <div className="space-y-4">
          {tokens.map((token) => {
            const status = statusConfig[token.status];
            const isVisible = visibleTokens.has(token.id);
            
            return (
              <div key={token.id} className="card-elevated p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{token.nome}</h3>
                      <p className="text-sm text-muted-foreground">{token.empresa}</p>
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
                        <DropdownMenuItem>
                          Editar permissões
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          {token.status === "ativo" ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          Regenerar token
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1.5">Token</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono text-foreground">
                      {isVisible ? token.token : maskToken(token.token)}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={() => toggleTokenVisibility(token.id)}
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={() => copyToken(token.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(token.criadoEm).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {token.expiraEm && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expira em</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(token.expiraEm).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {token.ultimoUso && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Último uso</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(token.ultimoUso).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Permissões</p>
                  <div className="flex flex-wrap gap-2">
                    {token.permissoes.map((perm) => (
                      <span 
                        key={perm} 
                        className="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-md"
                      >
                        {permissaoLabels[perm] || perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* API Documentation link */}
        <div className="card-elevated p-6 text-center">
          <h3 className="text-base font-semibold text-foreground mb-2">Documentação da API</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Acesse nossa documentação completa para integrar seu ERP ou PDV com a plataforma de emissão de NFC-e.
          </p>
          <Button variant="outline">
            Ver Documentação
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
