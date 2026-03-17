export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      certificados_digitais: {
        Row: {
          arquivo_path: string | null
          cnpj_certificado: string | null
          created_at: string
          data_emissao: string | null
          data_vencimento: string
          emissor: string | null
          empresa_id: string
          id: string
          senha_hash: string | null
          status: Database["public"]["Enums"]["certificado_status"]
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          cnpj_certificado?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento: string
          emissor?: string | null
          empresa_id: string
          id?: string
          senha_hash?: string | null
          status?: Database["public"]["Enums"]["certificado_status"]
          tipo?: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          cnpj_certificado?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string
          emissor?: string | null
          empresa_id?: string
          id?: string
          senha_hash?: string | null
          status?: Database["public"]["Enums"]["certificado_status"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_digitais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_fiscais: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          dados: Json | null
          descricao: string
          empresa_id: string
          id: string
          tipo: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          dados?: Json | null
          descricao: string
          empresa_id: string
          id?: string
          tipo: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          dados?: Json | null
          descricao?: string
          empresa_id?: string
          id?: string
          tipo?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          api_key_fiscal: string | null
          ativo: boolean
          bairro: string | null
          cep: string | null
          cnae_principal: string | null
          cnpj: string | null
          codigo_municipio: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          csc_id: string | null
          csc_token: string | null
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          municipio: string
          nome_fantasia: string | null
          numero: string | null
          numero_nfce_atual: number
          numero_nfe_atual: number
          razao_social: string
          regime_tributario: Database["public"]["Enums"]["regime_tributario"]
          serie_nfce: string
          serie_nfe: string
          telefone: string | null
          tipo_pessoa: string
          uf: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ambiente?: Database["public"]["Enums"]["ambiente_sefaz"]
          api_key_fiscal?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          municipio: string
          nome_fantasia?: string | null
          numero?: string | null
          numero_nfce_atual?: number
          numero_nfe_atual?: number
          razao_social: string
          regime_tributario?: Database["public"]["Enums"]["regime_tributario"]
          serie_nfce?: string
          serie_nfe?: string
          telefone?: string | null
          tipo_pessoa?: string
          uf: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["ambiente_sefaz"]
          api_key_fiscal?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          municipio?: string
          nome_fantasia?: string | null
          numero?: string | null
          numero_nfce_atual?: number
          numero_nfe_atual?: number
          razao_social?: string
          regime_tributario?: Database["public"]["Enums"]["regime_tributario"]
          serie_nfce?: string
          serie_nfe?: string
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fila_processamento: {
        Row: {
          created_at: string
          erro_ultimo: string | null
          id: string
          max_tentativas: number
          nfce_id: string
          prioridade: number
          proximo_processamento: string
          tentativas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          erro_ultimo?: string | null
          id?: string
          max_tentativas?: number
          nfce_id: string
          prioridade?: number
          proximo_processamento?: string
          tentativas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          erro_ultimo?: string | null
          id?: string
          max_tentativas?: number
          nfce_id?: string
          prioridade?: number
          proximo_processamento?: string
          tentativas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_processamento_nfce_id_fkey"
            columns: ["nfce_id"]
            isOneToOne: true
            referencedRelation: "nfce"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_processamento_nfe: {
        Row: {
          created_at: string
          erro_ultimo: string | null
          id: string
          max_tentativas: number
          nfe_id: string
          prioridade: number
          proximo_processamento: string
          tentativas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          erro_ultimo?: string | null
          id?: string
          max_tentativas?: number
          nfe_id: string
          prioridade?: number
          proximo_processamento?: string
          tentativas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          erro_ultimo?: string | null
          id?: string
          max_tentativas?: number
          nfe_id?: string
          prioridade?: number
          proximo_processamento?: string
          tentativas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_processamento_nfe_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: true
            referencedRelation: "nfe"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_fiscais: {
        Row: {
          categoria: string
          created_at: string
          detalhes: Json | null
          empresa_id: string | null
          id: string
          ip_origem: string | null
          mensagem: string
          nfce_id: string | null
          tipo: string
          token_api_id: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          ip_origem?: string | null
          mensagem: string
          nfce_id?: string | null
          tipo: string
          token_api_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          ip_origem?: string | null
          mensagem?: string
          nfce_id?: string | null
          tipo?: string
          token_api_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_fiscais_nfce_id_fkey"
            columns: ["nfce_id"]
            isOneToOne: false
            referencedRelation: "nfce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_fiscais_token_api_id_fkey"
            columns: ["token_api_id"]
            isOneToOne: false
            referencedRelation: "tokens_api"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce: {
        Row: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso: string | null
          codigo_retorno: string | null
          created_at: string
          data_autorizacao: string | null
          data_emissao: string
          empresa_id: string
          erro_processamento: string | null
          external_id: string | null
          id: string
          motivo_retorno: string | null
          numero: string
          payload_entrada: Json
          processado_em: string | null
          protocolo: string | null
          qrcode_url: string | null
          serie: string
          status: Database["public"]["Enums"]["nfce_status"]
          tentativas: number
          token_api_id: string | null
          updated_at: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_total: number
          xml_envio: string | null
          xml_retorno: string | null
        }
        Insert: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso?: string | null
          codigo_retorno?: string | null
          created_at?: string
          data_autorizacao?: string | null
          data_emissao?: string
          empresa_id: string
          erro_processamento?: string | null
          external_id?: string | null
          id?: string
          motivo_retorno?: string | null
          numero: string
          payload_entrada: Json
          processado_em?: string | null
          protocolo?: string | null
          qrcode_url?: string | null
          serie: string
          status?: Database["public"]["Enums"]["nfce_status"]
          tentativas?: number
          token_api_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_total: number
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso?: string | null
          codigo_retorno?: string | null
          created_at?: string
          data_autorizacao?: string | null
          data_emissao?: string
          empresa_id?: string
          erro_processamento?: string | null
          external_id?: string | null
          id?: string
          motivo_retorno?: string | null
          numero?: string
          payload_entrada?: Json
          processado_em?: string | null
          protocolo?: string | null
          qrcode_url?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["nfce_status"]
          tentativas?: number
          token_api_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_total?: number
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfce_token_api_id_fkey"
            columns: ["token_api_id"]
            isOneToOne: false
            referencedRelation: "tokens_api"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_eventos: {
        Row: {
          codigo_retorno: string | null
          created_at: string
          data_evento: string
          id: string
          justificativa: string | null
          motivo_retorno: string | null
          nfce_id: string
          protocolo: string | null
          sequencia: number
          tipo_evento: string
          xml_evento: string | null
          xml_retorno: string | null
        }
        Insert: {
          codigo_retorno?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          justificativa?: string | null
          motivo_retorno?: string | null
          nfce_id: string
          protocolo?: string | null
          sequencia?: number
          tipo_evento: string
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Update: {
          codigo_retorno?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          justificativa?: string | null
          motivo_retorno?: string | null
          nfce_id?: string
          protocolo?: string | null
          sequencia?: number
          tipo_evento?: string
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_eventos_nfce_id_fkey"
            columns: ["nfce_id"]
            isOneToOne: false
            referencedRelation: "nfce"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_itens: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          cfop: string
          codigo_produto: string
          created_at: string
          csosn: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          descricao: string
          id: string
          ncm: string | null
          nfce_id: string
          numero_item: number
          quantidade: number
          unidade: string
          valor_cofins: number | null
          valor_icms: number | null
          valor_pis: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cfop: string
          codigo_produto: string
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao: string
          id?: string
          ncm?: string | null
          nfce_id: string
          numero_item: number
          quantidade: number
          unidade: string
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cfop?: string
          codigo_produto?: string
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string
          id?: string
          ncm?: string | null
          nfce_id?: string
          numero_item?: number
          quantidade?: number
          unidade?: string
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfce_itens_nfce_id_fkey"
            columns: ["nfce_id"]
            isOneToOne: false
            referencedRelation: "nfce"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe: {
        Row: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso: string | null
          codigo_retorno: string | null
          created_at: string
          data_autorizacao: string | null
          data_emissao: string
          dest_bairro: string | null
          dest_cep: string | null
          dest_codigo_municipio: string | null
          dest_complemento: string | null
          dest_cpf_cnpj: string | null
          dest_email: string | null
          dest_ie: string | null
          dest_logradouro: string | null
          dest_municipio: string | null
          dest_nome: string | null
          dest_numero: string | null
          dest_telefone: string | null
          dest_uf: string | null
          empresa_id: string
          erro_processamento: string | null
          external_id: string | null
          finalidade: string
          id: string
          modalidade_frete: string
          motivo_retorno: string | null
          natureza_operacao: string
          numero: string
          payload_entrada: Json
          processado_em: string | null
          protocolo: string | null
          serie: string
          status: Database["public"]["Enums"]["nfce_status"]
          tentativas: number
          token_api_id: string | null
          updated_at: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_outras_despesas: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_seguro: number | null
          valor_total: number
          xml_envio: string | null
          xml_retorno: string | null
        }
        Insert: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso?: string | null
          codigo_retorno?: string | null
          created_at?: string
          data_autorizacao?: string | null
          data_emissao?: string
          dest_bairro?: string | null
          dest_cep?: string | null
          dest_codigo_municipio?: string | null
          dest_complemento?: string | null
          dest_cpf_cnpj?: string | null
          dest_email?: string | null
          dest_ie?: string | null
          dest_logradouro?: string | null
          dest_municipio?: string | null
          dest_nome?: string | null
          dest_numero?: string | null
          dest_telefone?: string | null
          dest_uf?: string | null
          empresa_id: string
          erro_processamento?: string | null
          external_id?: string | null
          finalidade?: string
          id?: string
          modalidade_frete?: string
          motivo_retorno?: string | null
          natureza_operacao?: string
          numero: string
          payload_entrada: Json
          processado_em?: string | null
          protocolo?: string | null
          serie: string
          status?: Database["public"]["Enums"]["nfce_status"]
          tentativas?: number
          token_api_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_outras_despesas?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total: number
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["ambiente_sefaz"]
          chave_acesso?: string | null
          codigo_retorno?: string | null
          created_at?: string
          data_autorizacao?: string | null
          data_emissao?: string
          dest_bairro?: string | null
          dest_cep?: string | null
          dest_codigo_municipio?: string | null
          dest_complemento?: string | null
          dest_cpf_cnpj?: string | null
          dest_email?: string | null
          dest_ie?: string | null
          dest_logradouro?: string | null
          dest_municipio?: string | null
          dest_nome?: string | null
          dest_numero?: string | null
          dest_telefone?: string | null
          dest_uf?: string | null
          empresa_id?: string
          erro_processamento?: string | null
          external_id?: string | null
          finalidade?: string
          id?: string
          modalidade_frete?: string
          motivo_retorno?: string | null
          natureza_operacao?: string
          numero?: string
          payload_entrada?: Json
          processado_em?: string | null
          protocolo?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["nfce_status"]
          tentativas?: number
          token_api_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_outras_despesas?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_token_api_id_fkey"
            columns: ["token_api_id"]
            isOneToOne: false
            referencedRelation: "tokens_api"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_eventos: {
        Row: {
          codigo_retorno: string | null
          created_at: string
          data_evento: string
          id: string
          justificativa: string | null
          motivo_retorno: string | null
          nfe_id: string
          protocolo: string | null
          sequencia: number
          tipo_evento: string
          xml_evento: string | null
          xml_retorno: string | null
        }
        Insert: {
          codigo_retorno?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          justificativa?: string | null
          motivo_retorno?: string | null
          nfe_id: string
          protocolo?: string | null
          sequencia?: number
          tipo_evento: string
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Update: {
          codigo_retorno?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          justificativa?: string | null
          motivo_retorno?: string | null
          nfe_id?: string
          protocolo?: string | null
          sequencia?: number
          tipo_evento?: string
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_eventos_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "nfe"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_itens: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          cfop: string
          codigo_produto: string
          created_at: string
          csosn: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          descricao: string
          id: string
          ncm: string | null
          nfe_id: string
          numero_item: number
          quantidade: number
          unidade: string
          valor_cofins: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_pis: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          cfop: string
          codigo_produto: string
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          descricao: string
          id?: string
          ncm?: string | null
          nfe_id: string
          numero_item: number
          quantidade: number
          unidade: string
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          cfop?: string
          codigo_produto?: string
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          descricao?: string
          id?: string
          ncm?: string | null
          nfe_id?: string
          numero_item?: number
          quantidade?: number
          unidade?: string
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_itens_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "nfe"
            referencedColumns: ["id"]
          },
        ]
      }
      series_fiscais: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          numero_atual: number
          serie: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          numero_atual?: number
          serie: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          numero_atual?: number
          serie?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens_api: {
        Row: {
          created_at: string
          empresa_id: string
          expires_at: string | null
          id: string
          ip_ultimo_uso: string | null
          nome: string
          permissoes: string[]
          status: Database["public"]["Enums"]["token_status"]
          token_hash: string
          token_prefix: string
          ultimo_uso: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          expires_at?: string | null
          id?: string
          ip_ultimo_uso?: string | null
          nome: string
          permissoes?: string[]
          status?: Database["public"]["Enums"]["token_status"]
          token_hash: string
          token_prefix: string
          ultimo_uso?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          expires_at?: string | null
          id?: string
          ip_ultimo_uso?: string | null
          nome?: string
          permissoes?: string[]
          status?: Database["public"]["Enums"]["token_status"]
          token_hash?: string
          token_prefix?: string
          ultimo_uso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_api_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          duracao_ms: number | null
          erro: string | null
          evento: string
          id: string
          nfce_id: string | null
          payload: Json
          response_body: string | null
          status_code: number | null
          sucesso: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          evento: string
          id?: string
          nfce_id?: string | null
          payload: Json
          response_body?: string | null
          status_code?: number | null
          sucesso?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          evento?: string
          id?: string
          nfce_id?: string | null
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          sucesso?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_nfce_id_fkey"
            columns: ["nfce_id"]
            isOneToOne: false
            referencedRelation: "nfce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          eventos: string[]
          falhas_consecutivas: number
          id: string
          nome: string
          secret: string
          ultimo_envio: string | null
          ultimo_status: number | null
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          eventos?: string[]
          falhas_consecutivas?: number
          id?: string
          nome: string
          secret: string
          ultimo_envio?: string | null
          ultimo_status?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          eventos?: string[]
          falhas_consecutivas?: number
          id?: string
          nome?: string
          secret?: string
          ultimo_envio?: string | null
          ultimo_status?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gerar_numero_nfce:
        | { Args: { p_empresa_id: string }; Returns: string }
        | { Args: { p_empresa_id: string; p_serie?: string }; Returns: string }
      gerar_numero_nfe:
        | { Args: { p_empresa_id: string }; Returns: string }
        | { Args: { p_empresa_id: string; p_serie?: string }; Returns: string }
      registrar_log: {
        Args: {
          p_categoria: string
          p_detalhes?: Json
          p_empresa_id: string
          p_ip_origem?: string
          p_mensagem: string
          p_nfce_id: string
          p_tipo: string
          p_token_api_id: string
        }
        Returns: string
      }
      validar_token_api: {
        Args: { p_token_hash: string }
        Returns: {
          ambiente: Database["public"]["Enums"]["ambiente_sefaz"]
          empresa_id: string
          permissoes: string[]
          token_id: string
        }[]
      }
    }
    Enums: {
      ambiente_sefaz: "homologacao" | "producao"
      certificado_status: "valido" | "expirando" | "expirado" | "pendente"
      nfce_status:
        | "pendente"
        | "processando"
        | "autorizada"
        | "rejeitada"
        | "cancelada"
        | "denegada"
        | "contingencia"
      regime_tributario: "simples_nacional" | "lucro_presumido" | "lucro_real"
      token_status: "ativo" | "inativo" | "revogado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ambiente_sefaz: ["homologacao", "producao"],
      certificado_status: ["valido", "expirando", "expirado", "pendente"],
      nfce_status: [
        "pendente",
        "processando",
        "autorizada",
        "rejeitada",
        "cancelada",
        "denegada",
        "contingencia",
      ],
      regime_tributario: ["simples_nacional", "lucro_presumido", "lucro_real"],
      token_status: ["ativo", "inativo", "revogado"],
    },
  },
} as const
