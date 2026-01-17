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
import { Loader2, Building2, FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { useCreateEmpresa, useUpdateEmpresa, Empresa } from "@/hooks/useSupabaseData";

// CNPJ validation
const validateCNPJ = (cnpj: string) => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
  
  // Validation algorithm
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

const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const empresaSchema = z.object({
  // Dados básicos
  razao_social: z.string().min(3, "Razão social deve ter no mínimo 3 caracteres").max(150),
  nome_fantasia: z.string().max(100).optional().nullable(),
  cnpj: z.string().refine(val => validateCNPJ(val), "CNPJ inválido"),
  inscricao_estadual: z.string().max(20).optional().nullable(),
  
  // Endereço
  uf: z.string().length(2, "UF deve ter 2 caracteres"),
  municipio: z.string().min(2, "Município é obrigatório").max(100),
  codigo_municipio: z.string().length(7, "Código do município deve ter 7 dígitos").optional().nullable(),
  
  // Configurações fiscais
  regime_tributario: z.enum(["simples_nacional", "lucro_presumido", "lucro_real"]),
  ambiente: z.enum(["homologacao", "producao"]),
  serie_nfce: z.string().min(1).max(3).default("001"),
  
  // CSC (Código de Segurança do Contribuinte)
  csc_id: z.string().max(10).optional().nullable(),
  csc_token: z.string().max(50).optional().nullable(),
  
  // Status
  ativo: z.boolean().default(true),
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

export function EmpresaFormDialog({ open, onOpenChange, empresa, onSuccess }: EmpresaFormDialogProps) {
  const [activeTab, setActiveTab] = useState("dados");
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  
  const isEditing = !!empresa;
  
  const form = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      inscricao_estadual: "",
      uf: "SP",
      municipio: "",
      codigo_municipio: "",
      regime_tributario: "simples_nacional",
      ambiente: "homologacao",
      serie_nfce: "001",
      csc_id: "",
      csc_token: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (empresa) {
      form.reset({
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia || "",
        cnpj: empresa.cnpj,
        inscricao_estadual: empresa.inscricao_estadual || "",
        uf: empresa.uf,
        municipio: empresa.municipio,
        codigo_municipio: empresa.codigo_municipio || "",
        regime_tributario: empresa.regime_tributario,
        ambiente: empresa.ambiente,
        serie_nfce: empresa.serie_nfce,
        csc_id: empresa.csc_id || "",
        csc_token: empresa.csc_token || "",
        ativo: empresa.ativo,
      });
    } else {
      form.reset({
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        inscricao_estadual: "",
        uf: "SP",
        municipio: "",
        codigo_municipio: "",
        regime_tributario: "simples_nacional",
        ambiente: "homologacao",
        serie_nfce: "001",
        csc_id: "",
        csc_token: "",
        ativo: true,
      });
    }
  }, [empresa, form]);

  const handleClose = () => {
    form.reset();
    setActiveTab("dados");
    onOpenChange(false);
  };

  const onSubmit = async (data: EmpresaFormData) => {
    try {
      const cleanCNPJ = data.cnpj.replace(/\D/g, '');
      
      const empresaData = {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || null,
        cnpj: cleanCNPJ,
        inscricao_estadual: data.inscricao_estadual || null,
        uf: data.uf,
        municipio: data.municipio,
        codigo_municipio: data.codigo_municipio || null,
        regime_tributario: data.regime_tributario,
        ambiente: data.ambiente,
        serie_nfce: data.serie_nfce,
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
              : "Preencha os dados da empresa para cadastro. Campos com * são obrigatórios."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dados
                </TabsTrigger>
                <TabsTrigger value="fiscal" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Fiscal
                </TabsTrigger>
                <TabsTrigger value="nfce" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  NFC-e
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input placeholder="Razão social da empresa" {...field} />
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
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome fantasia" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00.000.000/0000-00" 
                            {...field}
                            onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                          />
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
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl>
                          <Input placeholder="Inscrição estadual" {...field} value={field.value || ""} />
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
                      <FormItem>
                        <FormLabel>Código IBGE</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0000000" 
                            maxLength={7}
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
                          />
                        </FormControl>
                        <FormDescription>Código IBGE do município (7 dígitos)</FormDescription>
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
                          <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                          <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                          <SelectItem value="lucro_real">Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
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
              </TabsContent>

              <TabsContent value="nfce" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="serie_nfce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Série NFC-e *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="001" 
                          maxLength={3}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0'))}
                        />
                      </FormControl>
                      <FormDescription>Série padrão para emissão de NFC-e</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
