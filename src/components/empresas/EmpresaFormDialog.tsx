import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, FileText, Settings, Search, MapPin, User, Building, Truck } from "lucide-react";
import { SeriesFiscaisManager } from "./SeriesFiscaisManager";
import { toast } from "sonner";
import { useCreateEmpresa, useUpdateEmpresa, Empresa } from "@/hooks/useSupabaseData";

// CNPJ validation
const validateCNPJ = (cnpj: string) => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
  
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size += 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
};

// CPF validation
const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cleanCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(cleanCPF.charAt(10));
};

const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1-$2');
};

const formatCEP = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, '$1-$2');
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numbers
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const empresaSchema = z.object({
  // Tipo de pessoa
  tipo_pessoa: z.enum(["PF", "PJ"]).default("PJ"),
  
  // Dados básicos
  razao_social: z.string().min(3, "Razão social / Nome deve ter no mínimo 3 caracteres").max(150),
  nome_fantasia: z.string().max(100).optional().nullable(),
  cnpj: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  inscricao_estadual: z.string().max(20).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  cnae_principal: z.string().max(10).optional().nullable(),
  
  // Endereço completo
  logradouro: z.string().max(150).optional().nullable(),
  numero: z.string().max(10).optional().nullable(),
  complemento: z.string().max(60).optional().nullable(),
  bairro: z.string().max(60).optional().nullable(),
  cep: z.string().max(10).optional().nullable(),
  uf: z.string().length(2, "UF deve ter 2 caracteres"),
  municipio: z.string().min(2, "Município é obrigatório").max(100),
  codigo_municipio: z.string().length(7, "Código do município deve ter 7 dígitos").optional().nullable(),
  
  // Configurações fiscais
  regime_tributario: z.enum(["simples_nacional", "lucro_presumido", "lucro_real"]),
  ambiente: z.enum(["homologacao", "producao"]),
  serie_nfce: z.string().min(1).max(3).default("001"),
  serie_nfe: z.string().min(1).max(3).default("001"),
  serie_mdfe: z.string().min(1).max(3).default("1"),
  rntrc: z.string().max(8).optional().nullable(),
  
  // CSC (Código de Segurança do Contribuinte)
  csc_id: z.string().max(10).optional().nullable(),
  csc_token: z.string().max(50).optional().nullable(),
  
  // Status
  ativo: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.tipo_pessoa === "PJ") {
    if (!data.cnpj || !validateCNPJ(data.cnpj)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ inválido", path: ["cnpj"] });
    }
  } else {
    if (!data.cpf || !validateCPF(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido", path: ["cpf"] });
    }
    if (!data.inscricao_estadual) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "IE é obrigatória para produtor rural", path: ["inscricao_estadual"] });
    }
  }
});

type EmpresaFormData = z.infer<typeof empresaSchema>;

interface EmpresaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
  onSuccess?: () => void;
}

const UFs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface CNPJData {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  codigo_municipio: number;
  ddd_telefone_1: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  descricao_tipo_de_logradouro: string;
}

export function EmpresaFormDialog({ open, onOpenChange, empresa, onSuccess }: EmpresaFormDialogProps) {
  const [activeTab, setActiveTab] = useState("dados");
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  
  const isEditing = !!empresa;
  
  const form = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      tipo_pessoa: "PJ",
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      cpf: "",
      inscricao_estadual: "",
      telefone: "",
      cnae_principal: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cep: "",
      uf: "SP",
      municipio: "",
      codigo_municipio: "",
      regime_tributario: "simples_nacional",
      ambiente: "homologacao",
      serie_nfce: "001",
      serie_nfe: "001",
      serie_mdfe: "1",
      rntrc: "",
      csc_id: "",
      csc_token: "",
      ativo: true,
    },
  });

  const tipoPessoa = form.watch("tipo_pessoa");

  useEffect(() => {
    if (empresa) {
      form.reset({
        tipo_pessoa: (empresa as any).tipo_pessoa || "PJ",
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia || "",
        cnpj: empresa.cnpj ? formatCNPJ(empresa.cnpj) : "",
        cpf: (empresa as any).cpf ? formatCPF((empresa as any).cpf) : "",
        inscricao_estadual: empresa.inscricao_estadual || "",
        telefone: (empresa as any).telefone || "",
        cnae_principal: (empresa as any).cnae_principal || "",
        logradouro: (empresa as any).logradouro || "",
        numero: (empresa as any).numero || "",
        complemento: (empresa as any).complemento || "",
        bairro: (empresa as any).bairro || "",
        cep: (empresa as any).cep ? formatCEP((empresa as any).cep) : "",
        uf: empresa.uf,
        municipio: empresa.municipio,
        codigo_municipio: empresa.codigo_municipio || "",
        regime_tributario: empresa.regime_tributario,
        ambiente: empresa.ambiente,
        serie_nfce: empresa.serie_nfce,
        serie_nfe: (empresa as any).serie_nfe || "001",
        serie_mdfe: (empresa as any).serie_mdfe || "1",
        rntrc: (empresa as any).rntrc || "",
        csc_id: empresa.csc_id || "",
        csc_token: empresa.csc_token || "",
        ativo: empresa.ativo,
      });
    } else {
      form.reset({
        tipo_pessoa: "PJ",
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        cpf: "",
        inscricao_estadual: "",
        telefone: "",
        cnae_principal: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cep: "",
        uf: "SP",
        municipio: "",
        codigo_municipio: "",
        regime_tributario: "simples_nacional",
        ambiente: "homologacao",
        serie_nfce: "001",
        serie_nfe: "001",
        serie_mdfe: "1",
        rntrc: "",
        csc_id: "",
        csc_token: "",
        ativo: true,
      });
    }
  }, [empresa, form]);

  const searchCNPJ = async () => {
    const cnpj = form.getValues("cnpj");
    const cleanCNPJ = (cnpj || "").replace(/\D/g, '');
    
    if (cleanCNPJ.length !== 14) {
      toast.error("CNPJ inválido. Digite os 14 dígitos.");
      return;
    }

    if (!validateCNPJ(cnpj || "")) {
      toast.error("CNPJ inválido. Verifique os dígitos.");
      return;
    }

    setIsSearchingCNPJ(true);
    
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("CNPJ não encontrado na base da Receita Federal");
        }
        throw new Error("Erro ao consultar CNPJ");
      }
      
      const data: CNPJData = await response.json();
      
      form.setValue("razao_social", data.razao_social || "");
      form.setValue("nome_fantasia", data.nome_fantasia || "");
      
      const logradouro = data.descricao_tipo_de_logradouro 
        ? `${data.descricao_tipo_de_logradouro} ${data.logradouro}` 
        : data.logradouro;
      form.setValue("logradouro", logradouro || "");
      form.setValue("numero", data.numero || "");
      form.setValue("complemento", data.complemento || "");
      form.setValue("bairro", data.bairro || "");
      form.setValue("cep", data.cep ? formatCEP(data.cep) : "");
      form.setValue("uf", data.uf || "SP");
      form.setValue("municipio", data.municipio || "");
      
      let codigoIBGE = "";
      if (data.uf && data.municipio) {
        try {
          const ibgeResponse = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.uf}/municipios`);
          if (ibgeResponse.ok) {
            const municipios = await ibgeResponse.json();
            const found = municipios.find((m: any) => 
              m.nome.toUpperCase() === data.municipio.toUpperCase()
            );
            if (found) {
              codigoIBGE = found.id.toString();
            }
          }
        } catch (e) {
          console.warn("Erro ao buscar código IBGE do município:", e);
        }
      }
      form.setValue("codigo_municipio", codigoIBGE || data.codigo_municipio?.toString() || "");
      
      if (data.ddd_telefone_1) {
        form.setValue("telefone", formatPhone(data.ddd_telefone_1.replace(/\D/g, '')));
      }
      
      if (data.cnae_fiscal) {
        form.setValue("cnae_principal", data.cnae_fiscal.toString());
      }
      
      toast.success("Dados do CNPJ carregados com sucesso!");
      
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar dados do CNPJ");
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setActiveTab("dados");
    onOpenChange(false);
  };

  const onSubmit = async (data: EmpresaFormData) => {
    try {
      const cleanCNPJ = data.tipo_pessoa === "PJ" ? (data.cnpj || "").replace(/\D/g, '') : null;
      const cleanCPF = data.tipo_pessoa === "PF" ? (data.cpf || "").replace(/\D/g, '') : null;
      const cleanCEP = data.cep?.replace(/\D/g, '') || null;
      const cleanPhone = data.telefone?.replace(/\D/g, '') || null;
      
      const empresaData: any = {
        tipo_pessoa: data.tipo_pessoa,
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || null,
        cnpj: cleanCNPJ,
        cpf: cleanCPF,
        inscricao_estadual: data.inscricao_estadual || null,
        telefone: cleanPhone,
        cnae_principal: data.cnae_principal || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cep: cleanCEP,
        uf: data.uf,
        municipio: data.municipio,
        codigo_municipio: data.codigo_municipio || null,
        regime_tributario: data.regime_tributario,
        ambiente: data.ambiente,
        serie_nfce: data.serie_nfce,
        serie_nfe: data.serie_nfe,
        serie_mdfe: data.serie_mdfe,
        rntrc: data.rntrc?.replace(/\D/g, '') || null,
        csc_id: data.csc_id || null,
        csc_token: data.csc_token || null,
        ativo: data.ativo,
      };

      if (isEditing && empresa) {
        await updateEmpresa.mutateAsync({ id: empresa.id, ...empresaData });
        toast.success("Empresa atualizada com sucesso!");
      } else {
        await createEmpresa.mutateAsync(empresaData);
        toast.success("Empresa cadastrada com sucesso!");
      }
      
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      toast.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} empresa: ${error.message}`);
    }
  };

  const isPending = createEmpresa.isPending || updateEmpresa.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize os dados da empresa cadastrada" 
              : "Selecione o tipo de pessoa e preencha os dados."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="dados" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dados
                </TabsTrigger>
                <TabsTrigger value="endereco" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </TabsTrigger>
                <TabsTrigger value="fiscal" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Fiscal
                </TabsTrigger>
                <TabsTrigger value="nfe" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  NF-e
                </TabsTrigger>
                <TabsTrigger value="nfce" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  NFC-e
                </TabsTrigger>
                <TabsTrigger value="mdfe" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  MDF-e
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipo de Pessoa */}
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="tipo_pessoa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Pessoa *</FormLabel>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={field.value === "PJ" ? "default" : "outline"}
                              className="flex-1"
                              onClick={() => field.onChange("PJ")}
                            >
                              <Building className="h-4 w-4 mr-2" />
                              Pessoa Jurídica (CNPJ)
                            </Button>
                            <Button
                              type="button"
                              variant={field.value === "PF" ? "default" : "outline"}
                              className="flex-1"
                              onClick={() => field.onChange("PF")}
                            >
                              <User className="h-4 w-4 mr-2" />
                              Pessoa Física (CPF)
                            </Button>
                          </div>
                          <FormDescription>
                            {field.value === "PF" 
                              ? "Para produtor rural pessoa física com Inscrição Estadual" 
                              : "Para empresas com CNPJ"
                            }
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* CNPJ (PJ) */}
                  {tipoPessoa === "PJ" && (
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ *</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input 
                                  placeholder="00.000.000/0000-00" 
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                                  className="flex-1"
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="secondary"
                                onClick={searchCNPJ}
                                disabled={isSearchingCNPJ}
                                className="shrink-0"
                              >
                                {isSearchingCNPJ ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Search className="h-4 w-4" />
                                )}
                                <span className="ml-2 hidden sm:inline">Buscar</span>
                              </Button>
                            </div>
                            <FormDescription>
                              Digite o CNPJ e clique em buscar para preencher automaticamente
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* CPF (PF - Produtor Rural) */}
                  {tipoPessoa === "PF" && (
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="000.000.000-00" 
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(formatCPF(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              CPF do produtor rural
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{tipoPessoa === "PF" ? "Nome Completo *" : "Razão Social *"}</FormLabel>
                        <FormControl>
                          <Input placeholder={tipoPessoa === "PF" ? "Nome completo do produtor" : "Razão social da empresa"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{tipoPessoa === "PF" ? "Nome da Propriedade" : "Nome Fantasia"}</FormLabel>
                        <FormControl>
                          <Input placeholder={tipoPessoa === "PF" ? "Nome da propriedade rural (opcional)" : "Nome fantasia"} {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inscricao_estadual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Inscrição Estadual {tipoPessoa === "PF" && <span className="text-destructive">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Inscrição estadual" {...field} value={field.value || ""} />
                        </FormControl>
                        {tipoPessoa === "PF" && (
                          <FormDescription>Obrigatória para produtor rural</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(00) 00000-0000" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnae_principal"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>CNAE Principal</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={tipoPessoa === "PF" ? "0111301 (Cultivo de arroz)" : "0000000"}
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
                          />
                        </FormControl>
                        <FormDescription>Código CNAE da atividade principal</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00000-000" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(formatCEP(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UFs.map(uf => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, Avenida, Estrada, etc." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123 ou SN" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Sala, Andar, Lote, etc." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Bairro" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="municipio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Município *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do município" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="codigo_municipio"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Código IBGE do Município</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0000000" 
                            maxLength={7}
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
                          />
                        </FormControl>
                        <FormDescription>Código IBGE do município (7 dígitos) - preenchido automaticamente na busca do CNPJ</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="fiscal" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="regime_tributario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime Tributário *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o regime" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="simples_nacional">Simples Nacional (CRT 1)</SelectItem>
                          <SelectItem value="lucro_presumido">Lucro Presumido (CRT 3)</SelectItem>
                          <SelectItem value="lucro_real">Lucro Real (CRT 3)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {tipoPessoa === "PF" 
                          ? "Produtor rural geralmente utiliza Simples Nacional ou regime normal"
                          : "O CRT (Código de Regime Tributário) será definido automaticamente"
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ambiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ambiente *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ambiente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                          <SelectItem value="producao">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Use Homologação para testes. Produção envia notas reais à SEFAZ.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {tipoPessoa === "PF" && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Produtor Rural - Pessoa Física
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      O produtor rural pessoa física emite NF-e utilizando CPF e Inscrição Estadual como identificadores.
                      Certifique-se de que o certificado digital A1 esteja vinculado ao CPF do produtor.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="nfe" className="space-y-4 mt-4">
                {isEditing && empresa ? (
                  <SeriesFiscaisManager empresaId={empresa.id} tipo="nfe" />
                ) : (
                  <FormField
                    control={form.control}
                    name="serie_nfe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Série NF-e Inicial *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="001" 
                            maxLength={3}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0'))}
                          />
                        </FormControl>
                        <FormDescription>Série inicial para emissão de NF-e. Após o cadastro, você poderá gerenciar múltiplas séries.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Configurações NF-e</h4>
                  <p className="text-sm text-muted-foreground">
                    A NF-e (modelo 55) utiliza o mesmo certificado digital A1 e ambiente (homologação/produção) 
                    configurados na aba Fiscal. {isEditing ? "Gerencie as séries e numeração acima." : "Após o cadastro, edite a empresa para gerenciar múltiplas séries e numeração."}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="nfce" className="space-y-4 mt-4">
                {tipoPessoa === "PF" ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">NFC-e não aplicável</h4>
                    <p className="text-sm text-muted-foreground">
                      Produtor rural pessoa física geralmente não emite NFC-e. 
                      Utilize a aba NF-e para configurar a emissão de notas fiscais.
                    </p>
                  </div>
                ) : (
                  <>
                    {isEditing && empresa ? (
                      <SeriesFiscaisManager empresaId={empresa.id} tipo="nfce" />
                    ) : (
                      <FormField
                        control={form.control}
                        name="serie_nfce"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Série NFC-e Inicial *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="001" 
                                maxLength={3}
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0'))}
                              />
                            </FormControl>
                            <FormDescription>Série inicial para NFC-e. Após o cadastro, gerencie múltiplas séries.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">CSC - Código de Segurança do Contribuinte</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        O CSC é obrigatório para emissão de NFC-e. Obtenha junto à SEFAZ do seu estado.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="csc_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ID do CSC</FormLabel>
                              <FormControl>
                                <Input placeholder="000001" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="csc_token"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Token CSC</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Token fornecido pela SEFAZ" 
                                  type="password"
                                  {...field} 
                                  value={field.value || ""} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="mdfe" className="space-y-4 mt-4">
                <div className={`flex items-center justify-between p-3 rounded-lg border ${form.watch("ambiente") === "producao" ? "bg-success/10 border-success/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium text-foreground">Ambiente atual:</span>
                    <span className={`font-semibold ${form.watch("ambiente") === "producao" ? "text-success" : "text-amber-600 dark:text-amber-400"}`}>
                      {form.watch("ambiente") === "producao" ? "Produção" : "Homologação (Testes)"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Altere na aba Fiscal</span>
                </div>

                {isEditing && empresa ? (
                  <SeriesFiscaisManager empresaId={empresa.id} tipo="mdfe" />
                ) : (
                  <FormField
                    control={form.control}
                    name="serie_mdfe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Série MDF-e Inicial *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1"
                            maxLength={3}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          />
                        </FormControl>
                        <FormDescription>Série inicial para emissão de MDF-e (Manifesto Eletrônico). Após o cadastro você poderá gerenciar múltiplas séries.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="rntrc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RNTRC</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000000"
                          maxLength={8}
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        />
                      </FormControl>
                      <FormDescription>
                        Registro Nacional de Transportadores Rodoviários de Carga (ANTT). Obrigatório para emissão de MDF-e.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Configurações MDF-e (modelo 58)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    O MDF-e (Manifesto Eletrônico de Documentos Fiscais) usa o mesmo certificado digital A1 e ambiente
                    configurados na aba Fiscal. Atualmente apenas o modal rodoviário (modal=1) está suportado.
                    Lembre-se de habilitar a permissão <code className="text-xs bg-muted px-1 py-0.5 rounded">emitir_mdfe</code> nos tokens de API que devem emitir MDF-e.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="btn-gradient">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Empresa"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
