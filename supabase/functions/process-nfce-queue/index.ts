import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFCeItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  ncm: string | null;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cst_icms: string | null;
  csosn: string | null;
  aliquota_icms: number;
  valor_icms: number;
  cst_pis: string | null;
  aliquota_pis: number;
  valor_pis: number;
  cst_cofins: string | null;
  aliquota_cofins: number;
  valor_cofins: number;
}

interface NFCeData {
  id: string;
  empresa_id: string;
  numero: string;
  serie: string;
  ambiente: 'homologacao' | 'producao';
  valor_total: number;
  valor_produtos: number;
  valor_desconto: number;
  valor_frete: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  data_emissao: string;
  payload_entrada: any;
}

interface EmpresaData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  uf: string;
  municipio: string;
  codigo_municipio: string | null;
  regime_tributario: string;
  csc_id: string | null;
  csc_token: string | null;
}

interface CertificadoData {
  arquivo_path: string;
  senha_hash: string | null;
}

// Generate access key (chave de acesso) for NFC-e
function generateChaveAcesso(
  uf: string,
  dataEmissao: Date,
  cnpj: string,
  modelo: string,
  serie: string,
  numero: string,
  tipoEmissao: string,
  codigoNumerico: string
): string {
  const ano = dataEmissao.getFullYear().toString().slice(-2);
  const mes = (dataEmissao.getMonth() + 1).toString().padStart(2, '0');
  
  const ufCodigos: Record<string, string> = {
    'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
    'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
    'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
    'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
    'SP': '35', 'SE': '28', 'TO': '17'
  };
  
  const cUF = ufCodigos[uf] || '35';
  const AAMM = ano + mes;
  const CNPJ = cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod = modelo.padStart(2, '0');
  const ser = serie.padStart(3, '0');
  const nNF = numero.padStart(9, '0');
  const tpEmis = tipoEmissao;
  const cNF = codigoNumerico.padStart(8, '0');
  
  const chaveBase = cUF + AAMM + CNPJ + mod + ser + nNF + tpEmis + cNF;
  
  // Calculate DV (verification digit) using mod 11
  let peso = 2;
  let soma = 0;
  for (let i = chaveBase.length - 1; i >= 0; i--) {
    soma += parseInt(chaveBase[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  
  return chaveBase + dv.toString();
}

// Generate QR Code URL
function generateQRCodeUrl(
  chaveAcesso: string,
  ambiente: string,
  cscId: string,
  cscToken: string,
  valorTotal: number
): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const vNF = valorTotal.toFixed(2);
  
  // Create hash for QR Code
  const qrCodeData = `chNFe=${chaveAcesso}|nVersao=100|tpAmb=${tpAmb}|cDest=|dhEmi=|vNF=${vNF}|vICMS=0.00|digVal=|cIdToken=${cscId}`;
  
  // In production, this would be properly hashed with CSC
  // For now, return a placeholder URL format
  const baseUrl = ambiente === 'producao' 
    ? 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica'
    : 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica';
    
  return `${baseUrl}/qrcode?p=${chaveAcesso}|2|${tpAmb}|${cscId}`;
}

// Simulate SEFAZ communication
async function sendToSefaz(
  nfce: NFCeData, 
  empresa: EmpresaData, 
  itens: NFCeItem[],
  certificado: CertificadoData | null
): Promise<{
  success: boolean;
  protocolo?: string;
  chaveAcesso?: string;
  qrcodeUrl?: string;
  codigoRetorno: string;
  motivoRetorno: string;
  xmlRetorno?: string;
}> {
  // Generate random code for chave de acesso
  const codigoNumerico = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
  
  const chaveAcesso = generateChaveAcesso(
    empresa.uf,
    new Date(nfce.data_emissao),
    empresa.cnpj,
    '65', // NFC-e model
    nfce.serie,
    nfce.numero,
    '1', // Normal emission
    codigoNumerico
  );
  
  // Validate prerequisites
  if (!empresa.csc_id || !empresa.csc_token) {
    return {
      success: false,
      codigoRetorno: '450',
      motivoRetorno: 'CSC não configurado para a empresa. Configure o CSC antes de emitir NFC-e.',
    };
  }
  
  if (!certificado) {
    return {
      success: false,
      codigoRetorno: '280',
      motivoRetorno: 'Certificado digital não encontrado ou expirado.',
    };
  }
  
  // In homologação, simulate success after validation
  if (nfce.ambiente === 'homologacao') {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 95% success rate in homologação
    if (Math.random() > 0.05) {
      const protocolo = `2${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const qrcodeUrl = generateQRCodeUrl(
        chaveAcesso,
        nfce.ambiente,
        empresa.csc_id,
        empresa.csc_token,
        nfce.valor_total
      );
      
      return {
        success: true,
        protocolo,
        chaveAcesso,
        qrcodeUrl,
        codigoRetorno: '100',
        motivoRetorno: 'Autorizado o uso da NF-e',
        xmlRetorno: `<?xml version="1.0"?><nfeProc><protNFe><infProt><chNFe>${chaveAcesso}</chNFe><nProt>${protocolo}</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`,
      };
    } else {
      // Simulate random rejection
      const rejectionReasons = [
        { code: '539', reason: 'Duplicidade de NFC-e' },
        { code: '233', reason: 'NCM inválido' },
        { code: '301', reason: 'Uso denegado: irregularidade fiscal' },
      ];
      const rejection = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
      
      return {
        success: false,
        codigoRetorno: rejection.code,
        motivoRetorno: rejection.reason,
      };
    }
  }
  
  // In production, this would make actual SEFAZ API call
  // For now, return error to prevent accidental production emissions
  return {
    success: false,
    codigoRetorno: '999',
    motivoRetorno: 'Comunicação com SEFAZ de produção não implementada. Use ambiente de homologação para testes.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔄 Starting NFC-e processing worker...');

    // Get pending items from processing queue
    const { data: filaItems, error: filaError } = await supabase
      .from('fila_processamento')
      .select('*')
      .lte('proximo_processamento', new Date().toISOString())
      .lt('tentativas', 3)
      .order('prioridade', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10);

    if (filaError) {
      console.error('Error fetching queue:', filaError);
      throw filaError;
    }

    if (!filaItems || filaItems.length === 0) {
      console.log('✓ No pending items in queue');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${filaItems.length} items to process`);

    let processed = 0;
    let authorized = 0;
    let rejected = 0;

    for (const item of filaItems) {
      try {
        console.log(`\n🔄 Processing NFC-e ID: ${item.nfce_id}`);

        // Get NFC-e data
        const { data: nfce, error: nfceError } = await supabase
          .from('nfce')
          .select('*')
          .eq('id', item.nfce_id)
          .single();

        if (nfceError || !nfce) {
          console.error(`NFC-e not found: ${item.nfce_id}`);
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);
          continue;
        }

        // Skip if already processed
        if (['autorizada', 'cancelada', 'denegada'].includes(nfce.status)) {
          console.log(`NFC-e ${nfce.numero} already processed with status: ${nfce.status}`);
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);
          continue;
        }

        // Update status to processing
        await supabase
          .from('nfce')
          .update({ status: 'processando' })
          .eq('id', item.nfce_id);

        // Get empresa data
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', nfce.empresa_id)
          .single();

        if (empresaError || !empresa) {
          throw new Error('Empresa não encontrada');
        }

        // Get NFC-e items
        const { data: itens } = await supabase
          .from('nfce_itens')
          .select('*')
          .eq('nfce_id', item.nfce_id)
          .order('numero_item', { ascending: true });

        // Get valid certificate
        const { data: certificado } = await supabase
          .from('certificados_digitais')
          .select('arquivo_path, senha_hash')
          .eq('empresa_id', nfce.empresa_id)
          .in('status', ['valido', 'expirando'])
          .order('data_vencimento', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Send to SEFAZ
        const result = await sendToSefaz(nfce, empresa, itens || [], certificado);

        if (result.success) {
          console.log(`✅ NFC-e ${nfce.numero} authorized - Protocol: ${result.protocolo}`);

          // Update NFC-e with authorization data
          await supabase
            .from('nfce')
            .update({
              status: 'autorizada',
              chave_acesso: result.chaveAcesso,
              protocolo: result.protocolo,
              qrcode_url: result.qrcodeUrl,
              codigo_retorno: result.codigoRetorno,
              motivo_retorno: result.motivoRetorno,
              xml_retorno: result.xmlRetorno,
              data_autorizacao: new Date().toISOString(),
              processado_em: new Date().toISOString(),
              tentativas: nfce.tentativas + 1,
            })
            .eq('id', item.nfce_id);

          // Remove from queue
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);

          // Log success
          await supabase.rpc('registrar_log', {
            p_empresa_id: nfce.empresa_id,
            p_nfce_id: nfce.id,
            p_token_api_id: nfce.token_api_id,
            p_tipo: 'info',
            p_categoria: 'sefaz',
            p_mensagem: `NFC-e ${nfce.numero} autorizada com protocolo ${result.protocolo}`,
            p_detalhes: { 
              chave_acesso: result.chaveAcesso,
              codigo_retorno: result.codigoRetorno 
            },
          });

          // Send webhook notification
          try {
            await supabase.functions.invoke('send-webhook', {
              body: { nfce_id: nfce.id, evento: 'nfce.autorizada' }
            });
          } catch (webhookError) {
            console.error('Webhook dispatch error:', webhookError);
          }

          authorized++;
        } else {
          console.log(`❌ NFC-e ${nfce.numero} rejected: ${result.motivoRetorno}`);

          const novasTentativas = item.tentativas + 1;
          const isDenegada = result.codigoRetorno.startsWith('3');
          
          // Update NFC-e
          await supabase
            .from('nfce')
            .update({
              status: isDenegada ? 'denegada' : (novasTentativas >= 3 ? 'rejeitada' : 'pendente'),
              codigo_retorno: result.codigoRetorno,
              motivo_retorno: result.motivoRetorno,
              erro_processamento: result.motivoRetorno,
              processado_em: new Date().toISOString(),
              tentativas: nfce.tentativas + 1,
            })
            .eq('id', item.nfce_id);

          if (isDenegada || novasTentativas >= 3) {
            // Remove from queue if denied or max attempts reached
            await supabase
              .from('fila_processamento')
              .delete()
              .eq('id', item.id);
          } else {
            // Schedule retry with exponential backoff
            const nextRetry = new Date();
            nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, novasTentativas) * 5);
            
            await supabase
              .from('fila_processamento')
              .update({
                tentativas: novasTentativas,
                proximo_processamento: nextRetry.toISOString(),
                erro_ultimo: result.motivoRetorno,
              })
              .eq('id', item.id);
          }

          // Log failure
          await supabase.rpc('registrar_log', {
            p_empresa_id: nfce.empresa_id,
            p_nfce_id: nfce.id,
            p_token_api_id: nfce.token_api_id,
            p_tipo: 'error',
            p_categoria: 'sefaz',
            p_mensagem: `NFC-e ${nfce.numero} rejeitada: ${result.motivoRetorno}`,
            p_detalhes: { 
              codigo_retorno: result.codigoRetorno,
              tentativa: novasTentativas 
            },
          });

          // Send webhook notification for final rejection or denial
          if (isDenegada || novasTentativas >= 3) {
            try {
              const webhookEvento = isDenegada ? 'nfce.denegada' : 'nfce.rejeitada';
              await supabase.functions.invoke('send-webhook', {
                body: { nfce_id: nfce.id, evento: webhookEvento }
              });
            } catch (webhookError) {
              console.error('Webhook dispatch error:', webhookError);
            }
          }

          rejected++;
        }

        processed++;
      } catch (itemError: any) {
        console.error(`Error processing item ${item.id}:`, itemError);
        
        // Update queue with error
        await supabase
          .from('fila_processamento')
          .update({
            tentativas: item.tentativas + 1,
            erro_ultimo: itemError.message,
            proximo_processamento: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
          .eq('id', item.id);

        // Revert NFC-e status to pending
        await supabase
          .from('nfce')
          .update({ status: 'pendente', erro_processamento: itemError.message })
          .eq('id', item.nfce_id);
      }
    }

    console.log(`\n✅ Processing complete: ${processed} processed, ${authorized} authorized, ${rejected} rejected`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processing complete',
        stats: { processed, authorized, rejected }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
