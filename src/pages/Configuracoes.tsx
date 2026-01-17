import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Building2, 
  Receipt, 
  Bell, 
  Shield, 
  Globe,
  Save
} from "lucide-react";

export default function Configuracoes() {
  return (
    <AppLayout title="Configurações" subtitle="Configurações gerais da plataforma">
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="geral" className="gap-2">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="nfce" className="gap-2">
              <Receipt className="h-4 w-4" />
              NFC-e
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Geral */}
          <TabsContent value="geral" className="space-y-6">
            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Informações da Conta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="razaoSocial">Razão Social</Label>
                  <Input id="razaoSocial" defaultValue="Empresa Matriz Ltda" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" defaultValue="00.000.000/0001-00" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue="contato@empresa.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" defaultValue="(11) 99999-9999" />
                </div>
              </div>
            </div>

            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Preferências
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Fuso horário</p>
                    <p className="text-sm text-muted-foreground">Horário para exibição de logs e eventos</p>
                  </div>
                  <Select defaultValue="america_sp">
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america_sp">América/São_Paulo (GMT-3)</SelectItem>
                      <SelectItem value="america_manaus">América/Manaus (GMT-4)</SelectItem>
                      <SelectItem value="america_fortaleza">América/Fortaleza (GMT-3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Formato de data</p>
                    <p className="text-sm text-muted-foreground">Como as datas são exibidas</p>
                  </div>
                  <Select defaultValue="dd_mm_yyyy">
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd_mm_yyyy">DD/MM/AAAA</SelectItem>
                      <SelectItem value="yyyy_mm_dd">AAAA-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* NFC-e */}
          <TabsContent value="nfce" className="space-y-6">
            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Configurações Padrão de NFC-e
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ambiente Padrão</Label>
                  <Select defaultValue="homologacao">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologação</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Série Padrão</Label>
                  <Input defaultValue="001" />
                </div>
                <div className="space-y-2">
                  <Label>Timeout SEFAZ (segundos)</Label>
                  <Input type="number" defaultValue="30" />
                </div>
                <div className="space-y-2">
                  <Label>Tentativas de Reenvio</Label>
                  <Input type="number" defaultValue="3" />
                </div>
              </div>
            </div>

            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Contingência</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Contingência automática</p>
                    <p className="text-sm text-muted-foreground">Ativar automaticamente em caso de indisponibilidade da SEFAZ</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notificar em contingência</p>
                    <p className="text-sm text-muted-foreground">Enviar alerta quando entrar em modo de contingência</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notificacoes" className="space-y-6">
            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Preferências de Notificação
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Certificado expirando</p>
                    <p className="text-sm text-muted-foreground">Alertar 30 dias antes do vencimento</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">NFC-e rejeitadas</p>
                    <p className="text-sm text-muted-foreground">Notificar quando uma NFC-e for rejeitada</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Status da SEFAZ</p>
                    <p className="text-sm text-muted-foreground">Alertar sobre indisponibilidade</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Relatórios diários</p>
                    <p className="text-sm text-muted-foreground">Resumo das operações do dia</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Canais de Notificação</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>E-mail para notificações</Label>
                  <Input type="email" placeholder="fiscal@empresa.com.br" />
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL (opcional)</Label>
                  <Input placeholder="https://api.empresa.com/webhook/nfce" />
                  <p className="text-xs text-muted-foreground">
                    Receba eventos via webhook para integração com sistemas externos
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Segurança */}
          <TabsContent value="seguranca" className="space-y-6">
            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança da Conta
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Autenticação em dois fatores</p>
                    <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configurar
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sessões ativas</p>
                    <p className="text-sm text-muted-foreground">Gerencie seus dispositivos conectados</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Ver sessões
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Alterar senha</p>
                    <p className="text-sm text-muted-foreground">Última alteração: 30 dias atrás</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Alterar
                  </Button>
                </div>
              </div>
            </div>

            <div className="card-elevated p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Log de Atividades</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Registrar todas as ações</p>
                    <p className="text-sm text-muted-foreground">Manter histórico de auditoria completo</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Retenção de logs</p>
                    <p className="text-sm text-muted-foreground">Período de armazenamento</p>
                  </div>
                  <Select defaultValue="90">
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save button */}
        <div className="flex justify-end">
          <Button className="btn-gradient">
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
