import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Empresa {
  id: string;
  user_id: string;
  tipo_pessoa: 'PF' | 'PJ';
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  cnae_principal: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string;
  municipio: string;
  codigo_municipio: string | null;
  regime_tributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  ambiente: 'homologacao' | 'producao';
  serie_nfce: string;
  serie_nfe: string;
  numero_nfce_atual: number;
  numero_nfe_atual: number;
  csc_id: string | null;
  csc_token: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenAPI {
  id: string;
  empresa_id: string;
  nome: string;
  token_hash: string;
  token_prefix: string;
  status: 'ativo' | 'inativo' | 'revogado';
  permissoes: string[];
  ultimo_uso: string | null;
  ip_ultimo_uso: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NFCe {
  id: string;
  empresa_id: string;
  numero: string;
  serie: string;
  chave_acesso: string | null;
  status: 'pendente' | 'processando' | 'autorizada' | 'rejeitada' | 'cancelada' | 'denegada' | 'contingencia';
  ambiente: 'homologacao' | 'producao';
  data_emissao: string;
  valor_total: number;
  protocolo: string | null;
  codigo_retorno: string | null;
  motivo_retorno: string | null;
  external_id: string | null;
  created_at: string;
}

export interface CertificadoDigital {
  id: string;
  empresa_id: string;
  tipo: string;
  emissor: string | null;
  data_emissao: string | null;
  data_vencimento: string;
  status: 'valido' | 'expirando' | 'expirado' | 'pendente';
  created_at: string;
}

// Empresas hooks
export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Empresa[];
    }
  });
}

export function useEmpresa(id: string | undefined) {
  return useQuery({
    queryKey: ['empresa', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Empresa | null;
    },
    enabled: !!id
  });
}

export function useCreateEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (empresa: {
      razao_social: string;
      nome_fantasia?: string | null;
      cnpj: string;
      inscricao_estadual?: string | null;
      telefone?: string | null;
      cnae_principal?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      uf: string;
      municipio: string;
      codigo_municipio?: string | null;
      regime_tributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
      ambiente: 'homologacao' | 'producao';
      serie_nfce: string;
      serie_nfe?: string;
      csc_id?: string | null;
      csc_token?: string | null;
      ativo?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('empresas')
        .insert({ ...empresa, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Register company on the external fiscal API
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'register_empresa', empresa_id: data.id }
        });
        
        if (fiscalError) {
          console.error('Erro ao registrar na API fiscal:', fiscalError);
          // Don't fail the creation, just warn
        } else {
          console.log('✅ Empresa registrada na API fiscal:', fiscalResult);
        }
      } catch (err) {
        console.error('Erro ao conectar com API fiscal:', err);
      }
      
      return data as Empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    }
  });
}

export function useUpdateEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...empresa }: {
      id: string;
      razao_social?: string;
      nome_fantasia?: string | null;
      cnpj?: string;
      inscricao_estadual?: string | null;
      telefone?: string | null;
      cnae_principal?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      uf?: string;
      municipio?: string;
      codigo_municipio?: string | null;
      regime_tributario?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
      ambiente?: 'homologacao' | 'producao';
      serie_nfce?: string;
      serie_nfe?: string;
      csc_id?: string | null;
      csc_token?: string | null;
      ativo?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('empresas')
        .update(empresa)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Re-register on fiscal API with updated data
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'register_empresa', empresa_id: id }
        });
        
        if (fiscalError) {
          console.error('Erro ao atualizar na API fiscal:', fiscalError);
        } else {
          console.log('✅ Empresa atualizada na API fiscal:', fiscalResult);
        }
      } catch (err) {
        console.error('Erro ao conectar com API fiscal:', err);
      }

      return data as Empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    }
  });
}

export function useDeleteEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    }
  });
}

// Tokens API hooks
export function useTokensAPI(empresaId?: string) {
  return useQuery({
    queryKey: ['tokens-api', empresaId],
    queryFn: async () => {
      let query = supabase.from('tokens_api').select('*');
      
      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TokenAPI[];
    }
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ empresaId, nome, permissoes }: { empresaId: string; nome: string; permissoes: string[] }) => {
      // Generate a random token
      const token = `nfce_${crypto.randomUUID().replace(/-/g, '')}`;
      const tokenPrefix = token.substring(0, 12);
      
      // Hash the token for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const { data: tokenData, error } = await supabase
        .from('tokens_api')
        .insert({
          empresa_id: empresaId,
          nome,
          token_hash: tokenHash,
          token_prefix: tokenPrefix,
          permissoes
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Return the full token only once (it won't be retrievable after this)
      return { ...tokenData, full_token: token };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens-api'] });
    }
  });
}

// NFC-e hooks
export function useNFCeList(filters?: { empresaId?: string; status?: string; ambiente?: 'producao' | 'homologacao' | 'todos'; limit?: number }) {
  return useQuery({
    queryKey: ['nfce-list', filters],
    queryFn: async () => {
      let query = supabase
        .from('nfce')
        .select(`
          id, numero, serie, chave_acesso, status, ambiente,
          data_emissao, valor_total, protocolo, external_id, created_at,
          empresas!inner(nome_fantasia, cnpj)
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50);
      
      if (filters?.empresaId) {
        query = query.eq('empresa_id', filters.empresaId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status as NFCe['status']);
      }
      if (filters?.ambiente && filters.ambiente !== 'todos') {
        query = query.eq('ambiente', filters.ambiente);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });
}

export function useNFCe(id: string | undefined) {
  return useQuery({
    queryKey: ['nfce', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('nfce')
        .select(`
          *,
          nfce_itens(*),
          nfce_eventos(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

// Certificados hooks
export function useCertificados() {
  return useQuery({
    queryKey: ['certificados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certificados_digitais')
        .select(`
          *,
          empresas(nome_fantasia, cnpj)
        `)
        .order('data_vencimento', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateCertificado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (certificado: {
      empresa_id: string;
      tipo: string;
      arquivo_path: string;
      cnpj_certificado?: string;
      emissor?: string;
      data_emissao?: string;
      data_vencimento: string;
      senha_hash?: string;
      status: 'valido' | 'expirando' | 'expirado' | 'pendente';
    }) => {
      const { data, error } = await supabase
        .from('certificados_digitais')
        .insert(certificado)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
    }
  });
}

// Webhooks hooks
export interface Webhook {
  id: string;
  empresa_id: string;
  nome: string;
  url: string;
  secret: string;
  eventos: string[];
  ativo: boolean;
  ultimo_envio: string | null;
  ultimo_status: number | null;
  falhas_consecutivas: number;
  created_at: string;
  updated_at: string;
}

export function useWebhooks(empresaId?: string) {
  return useQuery({
    queryKey: ['webhooks', empresaId],
    queryFn: async () => {
      let query = supabase.from('webhooks').select('*');
      
      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Webhook[];
    }
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (webhook: {
      empresa_id: string;
      nome: string;
      url: string;
      eventos: string[];
    }) => {
      // Generate a secret for webhook signature
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
      
      const { data, error } = await supabase
        .from('webhooks')
        .insert({ ...webhook, secret })
        .select()
        .single();
      
      if (error) throw error;
      return data as Webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...webhook }: {
      id: string;
      nome?: string;
      url?: string;
      eventos?: string[];
      ativo?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('webhooks')
        .update(webhook)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });
}

export function useWebhookLogs(webhookId?: string) {
  return useQuery({
    queryKey: ['webhook-logs', webhookId],
    queryFn: async () => {
      if (!webhookId) return [];
      
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!webhookId
  });
}

export function useDeleteCertificado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, arquivoPath }: { id: string; arquivoPath?: string | null }) => {
      // Delete file from storage if exists
      if (arquivoPath) {
        await supabase.storage.from('certificados').remove([arquivoPath]);
      }
      
      // Delete record
      const { error } = await supabase
        .from('certificados_digitais')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
    }
  });
}

// Logs hooks
export function useLogsFiscais(filters?: { empresaId?: string; tipo?: string; ambiente?: 'producao' | 'homologacao' | 'todos'; limit?: number }) {
  return useQuery({
    queryKey: ['logs-fiscais', filters],
    queryFn: async () => {
      let query = supabase
        .from('logs_fiscais')
        .select('*, empresas(ambiente)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);
      
      if (filters?.empresaId) {
        query = query.eq('empresa_id', filters.empresaId);
      }
      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.ambiente && filters.ambiente !== 'todos') {
        query = query.eq('empresas.ambiente', filters.ambiente);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });
}

// Series Fiscais hooks
export interface SerieFiscal {
  id: string;
  empresa_id: string;
  tipo: 'nfe' | 'nfce';
  serie: string;
  numero_atual: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useSeriesFiscais(empresaId?: string) {
  return useQuery({
    queryKey: ['series-fiscais', empresaId],
    queryFn: async () => {
      let query = supabase
        .from('series_fiscais')
        .select('*')
        .order('tipo', { ascending: true })
        .order('serie', { ascending: true });
      
      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SerieFiscal[];
    },
    enabled: !!empresaId
  });
}

export function useCreateSerieFiscal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serie: { empresa_id: string; tipo: 'nfe' | 'nfce'; serie: string; numero_atual?: number }) => {
      const { data, error } = await supabase
        .from('series_fiscais')
        .insert(serie)
        .select()
        .single();
      if (error) throw error;
      return data as SerieFiscal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-fiscais'] });
    }
  });
}

export function useUpdateSerieFiscal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; numero_atual?: number; ativo?: boolean; serie?: string }) => {
      const { data: result, error } = await supabase
        .from('series_fiscais')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as SerieFiscal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-fiscais'] });
    }
  });
}

export function useDeleteSerieFiscal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('series_fiscais')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-fiscais'] });
    }
  });
}

// Dashboard stats
export function useDashboardStats(ambiente: 'producao' | 'homologacao' | 'todos' = 'todos') {
  return useQuery({
    queryKey: ['dashboard-stats', ambiente],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const empresaQ = supabase.from('empresas').select('id', { count: 'exact' }).eq('ativo', true);
      let nfceQ = supabase.from('nfce').select('id, valor_total, status, ambiente').gte('created_at', today.toISOString());
      let nfeQ = supabase.from('nfe').select('id, valor_total, status, ambiente').gte('created_at', today.toISOString());
      const certQ = supabase.from('certificados_digitais').select('status');

      if (ambiente !== 'todos') {
        nfceQ = nfceQ.eq('ambiente', ambiente);
        nfeQ = nfeQ.eq('ambiente', ambiente);
      }
      const empresaFiltered = ambiente !== 'todos'
        ? supabase.from('empresas').select('id', { count: 'exact' }).eq('ativo', true).eq('ambiente', ambiente)
        : empresaQ;

      const [empresasRes, nfceHojeRes, nfeHojeRes, certRes] = await Promise.all([
        empresaFiltered, nfceQ, nfeQ, certQ
      ]);
      
      const nfceHoje = nfceHojeRes.data || [];
      const nfeHoje = nfeHojeRes.data || [];
      const certs = certRes.data || [];
      const totalEmpresas = empresasRes.count || 0;
      
      const totalNfceHoje = nfceHoje.length;
      const autorizadasNfceHoje = nfceHoje.filter(n => n.status === 'autorizada').length;
      const rejeitadasNfceHoje = nfceHoje.filter(n => n.status === 'rejeitada').length;
      const valorAutorizadoNfce = nfceHoje
        .filter(n => n.status === 'autorizada')
        .reduce((acc, n) => acc + Number(n.valor_total || 0), 0);
      
      const totalNfeHoje = nfeHoje.length;
      const autorizadasNfeHoje = nfeHoje.filter(n => n.status === 'autorizada').length;
      const rejeitadasNfeHoje = nfeHoje.filter(n => n.status === 'rejeitada').length;
      const valorAutorizadoNfe = nfeHoje
        .filter(n => n.status === 'autorizada')
        .reduce((acc, n) => acc + Number(n.valor_total || 0), 0);
      
      const totalDocHoje = totalNfceHoje + totalNfeHoje;
      const autorizadasHoje = autorizadasNfceHoje + autorizadasNfeHoje;
      const rejeitadasHoje = rejeitadasNfceHoje + rejeitadasNfeHoje;
      const taxaAutorizacao = totalDocHoje > 0 ? (autorizadasHoje / totalDocHoje) * 100 : 0;
      const valorAutorizadoHoje = valorAutorizadoNfce + valorAutorizadoNfe;
      const ticketMedio = autorizadasHoje > 0 ? valorAutorizadoHoje / autorizadasHoje : 0;

      const certsExpirando = certs.filter(c => c.status === 'expirando').length;
      const certsExpirados = certs.filter(c => c.status === 'expirado').length;
      
      return {
        totalEmpresas,
        totalNfceHoje,
        totalNfeHoje,
        totalDocHoje,
        autorizadasHoje,
        rejeitadasHoje,
        taxaAutorizacao: taxaAutorizacao.toFixed(1),
        valorAutorizadoHoje,
        ticketMedio,
        certsExpirando,
        certsExpirados,
      };
    },
    refetchInterval: 30000,
  });
}
