import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Handshake, Plus, KeyRound, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Parceiro = {
  id: string;
  nome: string;
  slug: string;
  email_contato: string | null;
  chave_prefix: string | null;
  status: string;
  created_at: string;
};

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Parceiros() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [novaChave, setNovaChave] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("parceiros")
      .select("id, nome, slug, email_contato, chave_prefix, status, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar os parceiros");
      setLoading(false);
      return;
    }
    setParceiros((data as Parceiro[]) || []);

    const { data: empresas } = await (supabase as any)
      .from("empresas")
      .select("parceiro_id");
    const mapa: Record<string, number> = {};
    (empresas || []).forEach((e: { parceiro_id: string | null }) => {
      if (e.parceiro_id) mapa[e.parceiro_id] = (mapa[e.parceiro_id] || 0) + 1;
    });
    setContagem(mapa);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async () => {
    if (!nome.trim() || !slug.trim()) {
      toast.error("Informe nome e identificador");
      return;
    }
    setSaving(true);
    const chave = `pk_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await (supabase as any).from("parceiros").insert({
      nome: nome.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      email_contato: email.trim() || null,
      chave_hash: await sha256Hex(chave),
      chave_prefix: chave.substring(0, 12),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFormOpen(false);
    setNome("");
    setSlug("");
    setEmail("");
    setNovaChave(chave);
    carregar();
  };

  const gerarNovaChave = async (p: Parceiro) => {
    const chave = `pk_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await (supabase as any)
      .from("parceiros")
      .update({ chave_hash: await sha256Hex(chave), chave_prefix: chave.substring(0, 12) })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovaChave(chave);
    carregar();
  };

  return (
    <AppLayout title="Parceiros">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Handshake className="h-6 w-6" /> Parceiros
            </h1>
            <p className="text-sm text-muted-foreground">
              Cada parceiro enxerga apenas as próprias empresas e documentos.
            </p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo parceiro
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {parceiros.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{p.nome}</span>
                    <Badge variant={p.status === "ativo" ? "default" : "secondary"}>{p.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Identificador: {p.slug}</p>
                  <p className="text-muted-foreground">
                    Empresas vinculadas: {contagem[p.id] || 0}
                  </p>
                  <p className="text-muted-foreground">
                    Chave: {p.chave_prefix ? `${p.chave_prefix}••••` : "nenhuma gerada"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => gerarNovaChave(p)}>
                    <KeyRound className="h-4 w-4 mr-2" /> Gerar nova chave
                  </Button>
                </CardContent>
              </Card>
            ))}
            {parceiros.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado ainda.</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
            <DialogDescription>
              A chave gerada é usada pelo ERP do parceiro no cadastro de empresas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Identificador</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: parceiro-abc" />
            </div>
            <div>
              <Label>E-mail de contato</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!novaChave} onOpenChange={() => setNovaChave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave do parceiro</DialogTitle>
            <DialogDescription>
              Copie agora: ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted p-3 text-xs">{novaChave}</code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(novaChave || "");
                toast.success("Chave copiada");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNovaChave(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
