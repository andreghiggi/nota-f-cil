import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, User, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateEmpresa, Empresa } from "@/hooks/useSupabaseData";

const validateCNPJ = (cnpj: string) => {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (slice: string) => {
    let sum = 0, pos = slice.length - 7;
    for (let i = slice.length; i >= 1; i--) {
      sum += parseInt(slice.charAt(slice.length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(c.substring(0, 12)) === parseInt(c.charAt(12)) && calc(c.substring(0, 13)) === parseInt(c.charAt(13));
};

const validateCPF = (cpf: string) => {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c.charAt(i)) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(c.charAt(9))) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c.charAt(i)) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(c.charAt(10));
};

const fmtCNPJ = (v: string) => v.replace(/\D/g, "").slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const fmtCPF = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1-$2");
const fmtCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const fmtPhone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n.length <= 10
    ? n.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : n.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const UFs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const schema = z.object({
  tipo_pessoa: z.enum(["PF", "PJ"]),
  razao_social: z.string().min(3, "Mínimo 3 caracteres"),
  nome_fantasia: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  inscricao_estadual: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  cnae_principal: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  uf: z.string().length(2),
  municipio: z.string().min(2, "Município obrigatório"),
  codigo_municipio: z.string().length(7, "7 dígitos IBGE").optional().nullable(),
  regime_tributario: z.enum(["simples_nacional", "lucro_presumido", "lucro_real"]),
  ambiente: z.enum(["homologacao", "producao"]),
}).superRefine((d, ctx) => {
  if (d.tipo_pessoa === "PJ") {
    if (!d.cnpj || !validateCNPJ(d.cnpj)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ inválido", path: ["cnpj"] });
  } else {
    if (!d.cpf || !validateCPF(d.cpf)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido", path: ["cpf"] });
    if (!d.inscricao_estadual) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "IE obrigatória", path: ["inscricao_estadual"] });
  }
});

type FormData = z.infer<typeof schema>;

interface Props {
  onCreated: (empresa: Empresa) => void;
}

export function StepEmpresa({ onCreated }: Props) {
  const createEmpresa = useCreateEmpresa();
  const [searching, setSearching] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_pessoa: "PJ", razao_social: "", nome_fantasia: "", cnpj: "", cpf: "",
      inscricao_estadual: "", telefone: "", cnae_principal: "",
      cep: "", logradouro: "", numero: "", complemento: "", bairro: "",
      uf: "SP", municipio: "", codigo_municipio: "",
      regime_tributario: "simples_nacional", ambiente: "homologacao",
    },
  });

  const tipo = form.watch("tipo_pessoa");

  const buscarCNPJ = async () => {
    const cnpj = (form.getValues("cnpj") || "").replace(/\D/g, "");
    if (cnpj.length !== 14 || !validateCNPJ(cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }
    setSearching(true);

    // Tenta múltiplas fontes (com fallback) — se todas falharem, permite cadastro manual
    const sources: Array<() => Promise<any>> = [
      async () => {
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (!r.ok) throw new Error("brasilapi");
        return await r.json();
      },
      async () => {
        const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (!r.ok) throw new Error("cnpjws");
        const d = await r.json();
        const est = d.estabelecimento || {};
        const ies: any[] = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
        const ufSigla = (est.estado?.sigla || "").toUpperCase();
        const chosenIE =
          ies.find((i) => i.ativo && (i.estado?.sigla || "").toUpperCase() === ufSigla) ||
          ies.find((i) => i.ativo) ||
          ies[0];
        return {
          razao_social: d.razao_social,
          nome_fantasia: est.nome_fantasia,
          logradouro: est.logradouro,
          descricao_tipo_de_logradouro: est.tipo_logradouro,
          numero: est.numero,
          complemento: est.complemento,
          bairro: est.bairro,
          cep: est.cep,
          uf: est.estado?.sigla,
          municipio: est.cidade?.nome,
          ddd_telefone_1: est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : undefined,
          cnae_fiscal: est.atividade_principal?.id,
          inscricao_estadual: chosenIE?.inscricao_estadual || null,
        };
      },
    ];

    let d: any = null;
    for (const fn of sources) {
      try { d = await fn(); if (d) break; } catch {}
    }

    if (!d) {
      toast.warning("Consulta automática indisponível. Preencha os dados manualmente.");
      setSearching(false);
      return;
    }

    try {
      form.setValue("razao_social", d.razao_social || "");
      form.setValue("nome_fantasia", d.nome_fantasia || "");
      const log = d.descricao_tipo_de_logradouro ? `${d.descricao_tipo_de_logradouro} ${d.logradouro}` : d.logradouro;
      form.setValue("logradouro", log || "");
      form.setValue("numero", d.numero || "");
      form.setValue("complemento", d.complemento || "");
      form.setValue("bairro", d.bairro || "");
      form.setValue("cep", d.cep ? fmtCEP(String(d.cep)) : "");
      form.setValue("uf", d.uf || "SP");
      form.setValue("municipio", d.municipio || "");
      if (d.ddd_telefone_1) form.setValue("telefone", fmtPhone(String(d.ddd_telefone_1).replace(/\D/g, "")));
      if (d.cnae_fiscal) form.setValue("cnae_principal", String(d.cnae_fiscal).replace(/\D/g, "").slice(0, 7));
      // Se a fonte primária não trouxe IE, complementa via cnpj.ws
      let ieValue = d.inscricao_estadual ? String(d.inscricao_estadual).replace(/\D/g, "") : "";
      if (!ieValue) {
        try {
          const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
          if (r.ok) {
            const jd = await r.json();
            const est = jd?.estabelecimento || {};
            const ies: any[] = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
            const uf = String(d.uf || "").toUpperCase();
            const chosen =
              ies.find((i) => i.ativo && (i.estado?.sigla || "").toUpperCase() === uf) ||
              ies.find((i) => i.ativo) ||
              ies[0];
            if (chosen?.inscricao_estadual) ieValue = String(chosen.inscricao_estadual).replace(/\D/g, "");
          }
        } catch {}
      }
      if (ieValue) form.setValue("inscricao_estadual", ieValue);
      try {
        const ibge = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${d.uf}/municipios`);
        if (ibge.ok) {
          const mun = await ibge.json();
          const f = mun.find((m: any) => m.nome.toUpperCase() === (d.municipio || "").toUpperCase());
          if (f) form.setValue("codigo_municipio", String(f.id));
        }
      } catch {}
      toast.success("Dados carregados!");
    } finally {
      setSearching(false);
    }
  };

  const onSubmit = async (d: FormData) => {
    try {
      const payload: any = {
        tipo_pessoa: d.tipo_pessoa,
        razao_social: d.razao_social,
        nome_fantasia: d.nome_fantasia || null,
        cnpj: d.tipo_pessoa === "PJ" ? (d.cnpj || "").replace(/\D/g, "") : null,
        cpf: d.tipo_pessoa === "PF" ? (d.cpf || "").replace(/\D/g, "") : null,
        inscricao_estadual: d.inscricao_estadual || null,
        telefone: d.telefone?.replace(/\D/g, "") || null,
        cnae_principal: d.cnae_principal || null,
        cep: d.cep?.replace(/\D/g, "") || null,
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        complemento: d.complemento || null,
        bairro: d.bairro || null,
        uf: d.uf,
        municipio: d.municipio,
        codigo_municipio: d.codigo_municipio || null,
        regime_tributario: d.regime_tributario,
        ambiente: d.ambiente,
        serie_nfce: "001",
        serie_nfe: "001",
        serie_mdfe: "1",
        ativo: true,
      };
      const empresa = await createEmpresa.mutateAsync(payload);
      toast.success("Empresa cadastrada!");
      onCreated(empresa as Empresa);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Tipo */}
        <FormField control={form.control} name="tipo_pessoa" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Pessoa</FormLabel>
            <div className="flex gap-2">
              <Button type="button" variant={field.value === "PJ" ? "default" : "outline"} className="flex-1" onClick={() => field.onChange("PJ")}>
                <Building className="h-4 w-4 mr-2" /> Pessoa Jurídica (CNPJ)
              </Button>
              <Button type="button" variant={field.value === "PF" ? "default" : "outline"} className="flex-1" onClick={() => field.onChange("PF")}>
                <User className="h-4 w-4 mr-2" /> Pessoa Física (CPF - Produtor Rural)
              </Button>
            </div>
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tipo === "PJ" ? (
            <FormField control={form.control} name="cnpj" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>CNPJ *</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="00.000.000/0000-00" {...field} value={field.value || ""} onChange={e => field.onChange(fmtCNPJ(e.target.value))} />
                  </FormControl>
                  <Button type="button" variant="secondary" onClick={buscarCNPJ} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
                <FormDescription>Digite o CNPJ e clique em buscar para preencher automaticamente.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          ) : (
            <FormField control={form.control} name="cpf" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>CPF *</FormLabel>
                <FormControl>
                  <Input placeholder="000.000.000-00" {...field} value={field.value || ""} onChange={e => field.onChange(fmtCPF(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <FormField control={form.control} name="razao_social" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>{tipo === "PF" ? "Nome Completo *" : "Razão Social *"}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
            <FormItem><FormLabel>{tipo === "PF" ? "Nome da Propriedade" : "Nome Fantasia"}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="inscricao_estadual" render={({ field }) => (
            <FormItem><FormLabel>Inscrição Estadual {tipo === "PF" && "*"}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="telefone" render={({ field }) => (
            <FormItem><FormLabel>Telefone</FormLabel>
              <FormControl><Input placeholder="(00) 00000-0000" {...field} value={field.value || ""} onChange={e => field.onChange(fmtPhone(e.target.value))} /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="cnae_principal" render={({ field }) => (
            <FormItem><FormLabel>CNAE Principal</FormLabel>
              <FormControl><Input placeholder="0000000" {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 7))} /></FormControl>
            </FormItem>
          )} />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold mb-3">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="cep" render={({ field }) => (
              <FormItem><FormLabel>CEP</FormLabel>
                <FormControl><Input placeholder="00000-000" {...field} value={field.value || ""} onChange={e => field.onChange(fmtCEP(e.target.value))} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="uf" render={({ field }) => (
              <FormItem><FormLabel>UF *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{UFs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="municipio" render={({ field }) => (
              <FormItem><FormLabel>Município *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="logradouro" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Logradouro</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="numero" render={({ field }) => (
              <FormItem><FormLabel>Número</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="bairro" render={({ field }) => (
              <FormItem><FormLabel>Bairro</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="complemento" render={({ field }) => (
              <FormItem><FormLabel>Complemento</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="codigo_municipio" render={({ field }) => (
              <FormItem><FormLabel>Código IBGE</FormLabel>
                <FormControl><Input maxLength={7} {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 7))} /></FormControl>
                <FormDescription>7 dígitos. Preenchido auto.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold mb-3">Configuração Fiscal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="regime_tributario" render={({ field }) => (
              <FormItem><FormLabel>Regime Tributário *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="ambiente" render={({ field }) => (
              <FormItem><FormLabel>Ambiente *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Recomendado iniciar em Homologação.</FormDescription>
              </FormItem>
            )} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="btn-gradient" disabled={createEmpresa.isPending}>
            {createEmpresa.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar e Avançar
          </Button>
        </div>
      </form>
    </Form>
  );
}
