import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, CheckCircle2, Key, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { useCreateToken, Empresa } from "@/hooks/useSupabaseData";

const PERMS = [
  { id: "emitir_nfce", label: "Emitir NFC-e" },
  { id: "emitir_nfe", label: "Emitir NF-e" },
  { id: "emitir_mdfe", label: "Emitir MDF-e" },
  { id: "consultar", label: "Consultar" },
  { id: "cancelar", label: "Cancelar" },
  { id: "reprocessar", label: "Reprocessar" },
  { id: "gerenciar", label: "Gerenciar (séries, certificados, ambiente)" },
];

interface Props {
  empresa: Empresa;
  modelosSelecionados: Set<"nfe" | "nfce" | "mdfe">;
  onDone: () => void;
  onSkip: () => void;
}

export function StepToken({ empresa, modelosSelecionados, onDone, onSkip }: Props) {
  const create = useCreateToken();
  const defaults = ["consultar"];
  if (modelosSelecionados.has("nfe")) defaults.push("emitir_nfe");
  if (modelosSelecionados.has("nfce")) defaults.push("emitir_nfce");
  if (modelosSelecionados.has("mdfe")) defaults.push("emitir_mdfe");

  const [nome, setNome] = useState(`Token ${empresa.nome_fantasia || empresa.razao_social}`);
  const [perms, setPerms] = useState<string[]>(defaults);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!nome.trim() || perms.length === 0) { toast.error("Nome e permissões obrigatórios"); return; }
    try {
      const r = await create.mutateAsync({ empresaId: empresa.id, nome, permissoes: perms });
      setToken(r.full_token);
      toast.success("Token gerado!");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const copy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (token) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-sm font-medium text-warning">⚠️ Guarde este token agora!</p>
          <p className="text-xs text-muted-foreground mt-1">Por segurança, ele não será exibido novamente.</p>
        </div>
        <div>
          <Label>Seu Token API</Label>
          <div className="flex gap-2 mt-1">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">{token}</code>
            <Button variant="outline" size="icon" onClick={copy}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="btn-gradient" onClick={onDone}>Avançar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 bg-info/5 border-info/20 text-sm text-muted-foreground">
        Crie um token para que seu ERP/PDV se conecte à API e possa emitir documentos fiscais para esta empresa.
      </div>

      <div className="space-y-2">
        <Label>Nome do Token</Label>
        <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: ERP Principal" />
      </div>

      <div className="space-y-2">
        <Label>Permissões</Label>
        <div className="space-y-2">
          {PERMS.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
              <Checkbox checked={perms.includes(p.id)}
                onCheckedChange={() => setPerms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
              <label className="text-sm cursor-pointer flex-1" onClick={() =>
                setPerms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                {p.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip}><SkipForward className="h-4 w-4 mr-2" /> Pular</Button>
        <Button className="btn-gradient" onClick={submit} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
          Gerar Token
        </Button>
      </div>
    </div>
  );
}
