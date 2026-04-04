import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Webhook, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useEmpresas, useCreateWebhook, Webhook as WebhookType } from "@/hooks/useSupabaseData";

const webhookSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  url: z.string().url("URL inválida").max(500),
  empresa_id: z.string().min(1, "Selecione uma empresa"),
  eventos: z.array(z.string()).min(1, "Selecione pelo menos um evento"),
});

type WebhookFormData = z.infer<typeof webhookSchema>;

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const eventosDisponiveis = [
  { id: "nfce.autorizada", label: "NFC-e Autorizada", description: "Quando uma NFC-e é autorizada pela SEFAZ" },
  { id: "nfce.rejeitada", label: "NFC-e Rejeitada", description: "Quando uma NFC-e é rejeitada após todas as tentativas" },
  { id: "nfce.cancelada", label: "NFC-e Cancelada", description: "Quando uma NFC-e autorizada é cancelada" },
  { id: "nfce.denegada", label: "NFC-e Denegada", description: "Quando uma NFC-e é denegada pela SEFAZ" },
  { id: "nfe.autorizada", label: "NF-e Autorizada", description: "Quando uma NF-e é autorizada pela SEFAZ" },
  { id: "nfe.rejeitada", label: "NF-e Rejeitada", description: "Quando uma NF-e é rejeitada após todas as tentativas" },
  { id: "nfe.cancelada", label: "NF-e Cancelada", description: "Quando uma NF-e autorizada é cancelada" },
];

export function WebhookFormDialog({ open, onOpenChange, onSuccess }: WebhookFormDialogProps) {
  const [createdWebhook, setCreatedWebhook] = useState<WebhookType | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  
  const { data: empresas, isLoading: empresasLoading } = useEmpresas();
  const createWebhook = useCreateWebhook();
  
  const form = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      nome: "",
      url: "",
      empresa_id: "",
      eventos: ["nfce.autorizada", "nfce.rejeitada", "nfce.cancelada"],
    },
  });

  const handleClose = () => {
    form.reset();
    setCreatedWebhook(null);
    setSecretCopied(false);
    onOpenChange(false);
  };

  const onSubmit = async (data: WebhookFormData) => {
    try {
      const result = await createWebhook.mutateAsync({
        empresa_id: data.empresa_id,
        nome: data.nome,
        url: data.url,
        eventos: data.eventos,
      });
      setCreatedWebhook(result);
      toast.success("Webhook criado com sucesso!");
      onSuccess?.();
    } catch (error: any) {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    }
  };

  const copySecret = () => {
    if (createdWebhook?.secret) {
      navigator.clipboard.writeText(createdWebhook.secret);
      setSecretCopied(true);
      toast.success("Secret copiado!");
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  const toggleEvento = (eventoId: string) => {
    const current = form.getValues("eventos");
    const updated = current.includes(eventoId)
      ? current.filter(e => e !== eventoId)
      : [...current, eventoId];
    form.setValue("eventos", updated, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!createdWebhook ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                Novo Webhook
              </DialogTitle>
              <DialogDescription>
                Configure um endpoint para receber notificações automáticas de eventos.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Webhook</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: ERP Principal, Sistema PDV" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL do Endpoint</FormLabel>
                      <FormControl>
                        <Input placeholder="https://seu-sistema.com/webhook/nfce" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL que receberá as notificações via POST
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="empresa_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma empresa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {empresas?.map((empresa) => (
                            <SelectItem key={empresa.id} value={empresa.id}>
                              {empresa.nome_fantasia || empresa.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventos"
                  render={() => (
                    <FormItem>
                      <FormLabel>Eventos</FormLabel>
                      <div className="space-y-2">
                        {eventosDisponiveis.map((evento) => (
                          <div
                            key={evento.id}
                            className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={evento.id}
                              checked={form.watch("eventos").includes(evento.id)}
                              onCheckedChange={() => toggleEvento(evento.id)}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={evento.id}
                                className="text-sm font-medium text-foreground cursor-pointer"
                              >
                                {evento.label}
                              </label>
                              <p className="text-xs text-muted-foreground">{evento.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createWebhook.isPending} className="btn-gradient">
                    {createWebhook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Webhook
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Webhook Criado!
              </DialogTitle>
              <DialogDescription>
                Copie o secret abaixo para validar as assinaturas das requisições.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm text-warning font-medium">
                  ⚠️ Guarde este secret em local seguro!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ele não será exibido novamente.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Webhook Secret</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono text-foreground break-all">
                    {createdWebhook.secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {secretCopied ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground">Validação de Assinatura</p>
                <p className="text-xs text-muted-foreground">
                  Cada requisição inclui o header <code className="bg-background px-1 rounded">X-Webhook-Signature</code> com 
                  uma assinatura HMAC-SHA256 do body usando este secret.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
