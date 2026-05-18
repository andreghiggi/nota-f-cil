import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, FileKey, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Empresa } from "@/hooks/useSupabaseData";

interface Props {
  empresa: Empresa;
  onDone: () => void;
  onSkip: () => void;
}

export function StepCertificado({ empresa, onDone, onSkip }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const empresaDoc = (empresa.cnpj || (empresa as any).cpf || "").replace(/\D/g, "");

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDrag(e.type === "dragenter" || e.type === "dragover");
  };

  const pickFile = (f: File) => {
    if (!/\.(pfx|p12)$/i.test(f.name)) {
      toast.error("Selecione arquivo .pfx ou .p12");
      return;
    }
    setFile(f); setResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  const fileToB64 = (f: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const v = r.result;
      if (typeof v !== "string") return rej(new Error("Erro leitura"));
      const b = v.split(",")[1];
      b ? res(b) : rej(new Error("Falha base64"));
    };
    r.onerror = () => rej(new Error("Erro leitura"));
    r.readAsDataURL(f);
  });

  const validate = async () => {
    if (!file || !senha) { toast.error("Arquivo e senha obrigatórios"); return; }
    setValidating(true); setResult(null);
    try {
      const b64 = await fileToB64(file);
      const { data, error } = await supabase.functions.invoke("validate-certificate", {
        body: { certificate: b64, password: senha },
      });
      if (error) throw error;
      if (data.valid) {
        setResult({ valid: true, ...data });
        toast.success("Certificado válido!");
      } else {
        setResult({ valid: false, error: data.error });
        toast.error(data.error || "Inválido");
      }
    } catch (e: any) {
      setResult({ valid: false, error: e.message });
      toast.error("Erro ao validar: " + e.message);
    } finally {
      setValidating(false);
    }
  };

  const upload = async () => {
    if (!file || !senha || !result?.valid) return;
    setUploading(true);
    try {
      const fileName = `${empresa.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("certificados").upload(fileName, file, {
        contentType: "application/x-pkcs12", upsert: false,
      });
      if (upErr) throw upErr;

      const venc = new Date(result.dataVencimento);
      const dias = Math.ceil((venc.getTime() - Date.now()) / 86400000);
      const status = dias <= 0 ? "expirado" : dias <= 60 ? "expirando" : "valido";

      const { error: dbErr } = await supabase.from("certificados_digitais").insert({
        empresa_id: empresa.id,
        tipo: "A1",
        arquivo_path: fileName,
        cnpj_certificado: result.cnpj,
        emissor: result.emissor,
        data_emissao: result.dataEmissao,
        data_vencimento: result.dataVencimento,
        senha_hash: btoa(senha),
        status,
      });
      if (dbErr) throw dbErr;
      toast.success("Certificado salvo!");
      onDone();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const docMatch = result?.valid && result.cnpj && empresaDoc &&
    result.cnpj.replace(/\D/g, "") !== empresaDoc;

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 bg-info/5 border-info/20 text-sm">
        <p className="text-muted-foreground">
          Faça upload do certificado digital <strong>A1 (.pfx ou .p12)</strong> emitido para
          <code className="mx-1 px-1.5 py-0.5 bg-muted rounded font-mono text-xs">
            {empresa.cnpj ? `CNPJ ${empresa.cnpj}` : `CPF ${(empresa as any).cpf}`}
          </code>.
        </p>
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          drag ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          file && "border-success bg-success/5"
        )}
        onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pfx,.p12" className="hidden"
          onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileKey className="h-8 w-8 text-success" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Arraste o arquivo .pfx ou clique para selecionar</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label>Senha do Certificado</Label>
        <div className="relative">
          <Input type={showPwd ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} className="pr-10" />
          <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button onClick={validate} variant="outline" className="w-full" disabled={!file || !senha || validating}>
        {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        Validar Certificado
      </Button>

      {result && (
        <div className={cn("rounded-lg p-4 border",
          result.valid ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30")}>
          {result.valid ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-success font-medium">
                <ShieldCheck className="h-4 w-4" /> Válido
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-muted-foreground">Documento</p><p className="font-mono">{result.cnpj}</p></div>
                <div><p className="text-muted-foreground">Emissor</p><p>{result.emissor}</p></div>
                <div><p className="text-muted-foreground">Emissão</p><p>{new Date(result.dataEmissao).toLocaleDateString("pt-BR")}</p></div>
                <div><p className="text-muted-foreground">Vencimento</p><p>{new Date(result.dataVencimento).toLocaleDateString("pt-BR")}</p></div>
              </div>
              {docMatch && (
                <p className="text-xs text-warning flex items-center gap-1 mt-2">
                  <AlertCircle className="h-3 w-3" /> Documento do certificado não corresponde à empresa
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" /> {result.error}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onSkip}>
          <SkipForward className="h-4 w-4 mr-2" /> Configurar depois
        </Button>
        <Button onClick={upload} disabled={!result?.valid || uploading} className="btn-gradient">
          {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e Avançar
        </Button>
      </div>
    </div>
  );
}
