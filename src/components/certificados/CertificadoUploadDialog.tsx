import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, FileKey } from "lucide-react";
import { useEmpresas } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CertificadoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CertificadoUploadDialog({ open, onOpenChange, onSuccess }: CertificadoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    cnpj?: string;
    emissor?: string;
    dataEmissao?: string;
    dataVencimento?: string;
    error?: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: empresas, isLoading: loadingEmpresas } = useEmpresas();

  const resetForm = () => {
    setFile(null);
    setSenha("");
    setSelectedEmpresa("");
    setValidationResult(null);
    setIsValidating(false);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.pfx') || droppedFile.name.toLowerCase().endsWith('.p12')) {
        setFile(droppedFile);
        setValidationResult(null);
      } else {
        toast.error("Arquivo inválido. Selecione um arquivo .pfx ou .p12");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.toLowerCase().endsWith('.pfx') || selectedFile.name.toLowerCase().endsWith('.p12')) {
        setFile(selectedFile);
        setValidationResult(null);
      } else {
        toast.error("Arquivo inválido. Selecione um arquivo .pfx ou .p12");
      }
    }
  };

  const validateCertificate = async () => {
    if (!file || !senha) {
      toast.error("Selecione um arquivo e informe a senha");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // Read file as base64 (chunk-safe for large files)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Call edge function to validate certificate
      const { data, error } = await supabase.functions.invoke('validate-certificate', {
        body: { 
          certificate: base64, 
          password: senha 
        }
      });

      if (error) throw error;

      if (data.valid) {
        setValidationResult({
          valid: true,
          cnpj: data.cnpj,
          emissor: data.emissor,
          dataEmissao: data.dataEmissao,
          dataVencimento: data.dataVencimento
        });
        toast.success("Certificado validado com sucesso!");
      } else {
        setValidationResult({
          valid: false,
          error: data.error || "Erro ao validar certificado"
        });
        toast.error(data.error || "Erro ao validar certificado");
      }
    } catch (error: any) {
      console.error("Erro na validação:", error);
      setValidationResult({
        valid: false,
        error: error.message || "Erro ao validar certificado. Verifique a senha."
      });
      toast.error("Erro ao validar certificado. Verifique a senha.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !senha || !selectedEmpresa || !validationResult?.valid) {
      toast.error("Preencha todos os campos e valide o certificado");
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `${selectedEmpresa}/${Date.now()}_${file.name}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(fileName, file, {
          contentType: 'application/x-pkcs12',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Create certificate record in database
      const { error: dbError } = await supabase
        .from('certificados_digitais')
        .insert({
          empresa_id: selectedEmpresa,
          tipo: 'A1',
          arquivo_path: fileName,
          cnpj_certificado: validationResult.cnpj,
          emissor: validationResult.emissor,
          data_emissao: validationResult.dataEmissao,
          data_vencimento: validationResult.dataVencimento,
          senha_hash: btoa(senha), // In production, use proper encryption
          status: calculateStatus(validationResult.dataVencimento!)
        });

      if (dbError) throw dbError;

      toast.success("Certificado cadastrado com sucesso!");
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao salvar certificado: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const calculateStatus = (dataVencimento: string): 'valido' | 'expirando' | 'expirado' => {
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes <= 0) return 'expirado';
    if (diasRestantes <= 60) return 'expirando';
    return 'valido';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Upload de Certificado Digital A1
          </DialogTitle>
          <DialogDescription>
            Selecione o arquivo .pfx e informe a senha para validação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              file && "border-success bg-success/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileKey className="h-8 w-8 text-success" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arraste o arquivo .pfx ou clique para selecionar
                </p>
              </>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="senha">Senha do Certificado</Label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha do certificado"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Validate Button */}
          <Button
            onClick={validateCertificate}
            disabled={!file || !senha || isValidating}
            variant="outline"
            className="w-full"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Validar Certificado
              </>
            )}
          </Button>

          {/* Validation Result */}
          {validationResult && (
            <div className={cn(
              "rounded-lg p-4 border",
              validationResult.valid 
                ? "bg-success/10 border-success/30" 
                : "bg-destructive/10 border-destructive/30"
            )}>
              {validationResult.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-success font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Certificado válido
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">CNPJ</p>
                      <p className="font-mono">{validationResult.cnpj}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Emissor</p>
                      <p>{validationResult.emissor}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Emissão</p>
                      <p>{validationResult.dataEmissao && new Date(validationResult.dataEmissao).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p>{validationResult.dataVencimento && new Date(validationResult.dataVencimento).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{validationResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Company Select - Only show after validation */}
          {validationResult?.valid && (
            <div className="space-y-2">
              <Label htmlFor="empresa">Vincular à Empresa</Label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger id="empresa">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEmpresas ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : empresas?.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhuma empresa cadastrada</SelectItem>
                  ) : (
                    empresas?.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.razao_social} - {empresa.cnpj}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {validationResult.cnpj && selectedEmpresa && empresas && (
                (() => {
                  const empresa = empresas.find(e => e.id === selectedEmpresa);
                  const cnpjMatch = empresa?.cnpj.replace(/\D/g, '') === validationResult.cnpj?.replace(/\D/g, '');
                  if (!cnpjMatch) {
                    return (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        O CNPJ do certificado não corresponde à empresa selecionada
                      </p>
                    );
                  }
                  return null;
                })()
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!validationResult?.valid || !selectedEmpresa || isUploading}
            className="btn-gradient"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Salvar Certificado
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
