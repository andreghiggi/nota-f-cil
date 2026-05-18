import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { OnboardingStepper, OnboardingStep } from "@/components/onboarding/OnboardingStepper";
import { StepEmpresa } from "@/components/onboarding/StepEmpresa";
import { StepCertificado } from "@/components/onboarding/StepCertificado";
import { StepSeries } from "@/components/onboarding/StepSeries";
import { StepToken } from "@/components/onboarding/StepToken";
import { Empresa } from "@/hooks/useSupabaseData";
import { ArrowLeft, CheckCircle2, Building2, ShieldCheck, FileText, Key, PartyPopper } from "lucide-react";

const steps: OnboardingStep[] = [
  { id: "empresa", label: "Empresa", description: "Dados cadastrais" },
  { id: "certificado", label: "Certificado", description: "A1 (.pfx)" },
  { id: "series", label: "Séries e Modelos", description: "NF-e / NFC-e / MDF-e" },
  { id: "token", label: "Token API", description: "Integração com ERP" },
  { id: "conclusao", label: "Conclusão", description: "Tudo pronto" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [modelos, setModelos] = useState<Set<"nfe" | "nfce" | "mdfe">>(new Set(["nfce"]));
  const [certOk, setCertOk] = useState(false);
  const [tokenOk, setTokenOk] = useState(false);

  const advance = (idx: number) => {
    setCompleted(prev => new Set(prev).add(current));
    setCurrent(idx);
  };

  return (
    <AppLayout title="Cadastro de Novo Cliente" subtitle="Passo a passo para colocar uma nova empresa no ar">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/empresas")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Empresas
        </Button>

        <div className="card-elevated p-6">
          <OnboardingStepper steps={steps} current={current} completed={completed} />
        </div>

        <div className="card-elevated p-6">
          {current === 0 && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Dados da Empresa</h2>
                  <p className="text-sm text-muted-foreground">Preencha os dados cadastrais. Para CNPJ, use a busca automática.</p>
                </div>
              </div>
              <StepEmpresa onCreated={(e) => { setEmpresa(e); advance(1); }} />
            </>
          )}

          {current === 1 && empresa && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Certificado Digital A1</h2>
                  <p className="text-sm text-muted-foreground">Necessário para assinar e transmitir documentos à SEFAZ.</p>
                </div>
              </div>
              <StepCertificado empresa={empresa} onDone={() => { setCertOk(true); advance(2); }} onSkip={() => advance(2)} />
            </>
          )}

          {current === 2 && empresa && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Modelos e Séries Fiscais</h2>
                  <p className="text-sm text-muted-foreground">Escolha quais documentos esta empresa vai emitir e ajuste a numeração.</p>
                </div>
              </div>
              <StepSeries empresa={empresa} selected={modelos} onSelectedChange={setModelos} onContinue={() => advance(3)} />
            </>
          )}

          {current === 3 && empresa && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Token de API</h2>
                  <p className="text-sm text-muted-foreground">Cria o token para conectar o ERP/PDV à nossa API fiscal.</p>
                </div>
              </div>
              <StepToken
                empresa={empresa}
                modelosSelecionados={modelos}
                onDone={() => { setTokenOk(true); advance(4); }}
                onSkip={() => advance(4)}
              />
            </>
          )}

          {current === 4 && empresa && (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <PartyPopper className="h-8 w-8 text-success" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A empresa <strong>{empresa.nome_fantasia || empresa.razao_social}</strong> foi cadastrada com sucesso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto text-left mt-6">
                <div className="card-elevated p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">Empresa cadastrada</span>
                </div>
                <div className="card-elevated p-3 flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${certOk ? "text-success" : "text-muted-foreground"}`} />
                  <span className="text-sm">{certOk ? "Certificado salvo" : "Certificado pendente"}</span>
                </div>
                <div className="card-elevated p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">{modelos.size} modelo(s) configurado(s)</span>
                </div>
                <div className="card-elevated p-3 flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${tokenOk ? "text-success" : "text-muted-foreground"}`} />
                  <span className="text-sm">{tokenOk ? "Token gerado" : "Token pendente"}</span>
                </div>
              </div>

              <div className="flex gap-2 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate("/empresas")}>Ir para Empresas</Button>
                <Button className="btn-gradient" onClick={() => navigate("/")}>Ir para o Dashboard</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
