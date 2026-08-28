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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          acao: string
          admin_auth_id: string
          created_at: string
          entidade: string
          entidade_id: string
          estado_anterior: Json | null
          estado_novo: Json | null
          id: string
          justificativa: string | null
        }
        Insert: {
          acao: string
          admin_auth_id: string
          created_at?: string
          entidade: string
          entidade_id: string
          estado_anterior?: Json | null
          estado_novo?: Json | null
          id?: string
          justificativa?: string | null
        }
        Update: {
          acao?: string
          admin_auth_id?: string
          created_at?: string
          entidade?: string
          entidade_id?: string
          estado_anterior?: Json | null
          estado_novo?: Json | null
          id?: string
          justificativa?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          ativo: boolean
          auth_user_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          avaliado_id: string
          avaliador_id: string
          comentario: string | null
          corrida_id: string
          created_at: string
          id: string
          nota: number
          updated_at: string
        }
        Insert: {
          avaliado_id: string
          avaliador_id: string
          comentario?: string | null
          corrida_id: string
          created_at?: string
          id?: string
          nota: number
          updated_at?: string
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string
          comentario?: string | null
          corrida_id?: string
          created_at?: string
          id?: string
          nota?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_avaliado_id_fkey"
            columns: ["avaliado_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_suporte: {
        Row: {
          arquivado_pelo_passageiro: boolean
          atendente_id: string | null
          corrida_id: string | null
          created_at: string
          data_resolucao: string | null
          descricao: string | null
          id: string
          status: Database["public"]["Enums"]["status_chamado_suporte"]
          tipo: Database["public"]["Enums"]["tipo_chamado_suporte"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          arquivado_pelo_passageiro?: boolean
          atendente_id?: string | null
          corrida_id?: string | null
          created_at?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_chamado_suporte"]
          tipo: Database["public"]["Enums"]["tipo_chamado_suporte"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          arquivado_pelo_passageiro?: boolean
          atendente_id?: string | null
          corrida_id?: string | null
          created_at?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_chamado_suporte"]
          tipo?: Database["public"]["Enums"]["tipo_chamado_suporte"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_suporte_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_suporte_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_suporte_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          client_message_id: string
          conteudo: string
          corrida_id: string
          created_at: string
          entregue_at: string | null
          id: string
          lido_at: string | null
          remetente_id: string
        }
        Insert: {
          client_message_id: string
          conteudo: string
          corrida_id: string
          created_at?: string
          entregue_at?: string | null
          id?: string
          lido_at?: string | null
          remetente_id: string
        }
        Update: {
          client_message_id?: string
          conteudo?: string
          corrida_id?: string
          created_at?: string
          entregue_at?: string | null
          id?: string
          lido_at?: string | null
          remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_presenca: {
        Row: {
          corrida_id: string
          digitando_ate: string | null
          ultimo_visto_at: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          corrida_id: string
          digitando_ate?: string | null
          ultimo_visto_at?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          corrida_id?: string
          digitando_ate?: string | null
          ultimo_visto_at?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_presenca_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_presenca_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cidades: {
        Row: {
          bandeirada: number
          comissao_pct: number
          created_at: string
          estado_uf: string
          id: string
          nome: string
          raio_atuacao_km: number
          status: Database["public"]["Enums"]["cidade_status"]
          tarifa_minima: number
          updated_at: string
          valor_km: number
          valor_min: number
        }
        Insert: {
          bandeirada?: number
          comissao_pct?: number
          created_at?: string
          estado_uf: string
          id?: string
          nome: string
          raio_atuacao_km?: number
          status?: Database["public"]["Enums"]["cidade_status"]
          tarifa_minima?: number
          updated_at?: string
          valor_km?: number
          valor_min?: number
        }
        Update: {
          bandeirada?: number
          comissao_pct?: number
          created_at?: string
          estado_uf?: string
          id?: string
          nome?: string
          raio_atuacao_km?: number
          status?: Database["public"]["Enums"]["cidade_status"]
          tarifa_minima?: number
          updated_at?: string
          valor_km?: number
          valor_min?: number
        }
        Relationships: []
      }
      contatos_confianca: {
        Row: {
          created_at: string
          id: string
          nome: string
          passageiro_id: string
          telefone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          passageiro_id: string
          telefone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          passageiro_id?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contatos_confianca_passageiro_id_fkey"
            columns: ["passageiro_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      corridas: {
        Row: {
          cancelado_por: Database["public"]["Enums"]["cancelado_por"] | null
          cidade_id: string
          codigo_embarque: string
          created_at: string
          data_aceite: string | null
          data_cancelamento: string | null
          data_chegada_motorista: string | null
          data_finalizacao: string | null
          data_inicio: string | null
          destino_lat: number
          destino_lng: number
          destino_nome: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          motivo_cancelamento: string | null
          motorista_id: string | null
          origem_lat: number
          origem_lng: number
          origem_nome: string | null
          passageiro_id: string
          status: Database["public"]["Enums"]["corrida_status"]
          updated_at: string
          valor_estimado: number
          valor_final: number | null
        }
        Insert: {
          cancelado_por?: Database["public"]["Enums"]["cancelado_por"] | null
          cidade_id: string
          codigo_embarque: string
          created_at?: string
          data_aceite?: string | null
          data_cancelamento?: string | null
          data_chegada_motorista?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          destino_lat: number
          destino_lng: number
          destino_nome?: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          motivo_cancelamento?: string | null
          motorista_id?: string | null
          origem_lat: number
          origem_lng: number
          origem_nome?: string | null
          passageiro_id: string
          status?: Database["public"]["Enums"]["corrida_status"]
          updated_at?: string
          valor_estimado: number
          valor_final?: number | null
        }
        Update: {
          cancelado_por?: Database["public"]["Enums"]["cancelado_por"] | null
          cidade_id?: string
          codigo_embarque?: string
          created_at?: string
          data_aceite?: string | null
          data_cancelamento?: string | null
          data_chegada_motorista?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          destino_lat?: number
          destino_lng?: number
          destino_nome?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          motivo_cancelamento?: string | null
          motorista_id?: string | null
          origem_lat?: number
          origem_lng?: number
          origem_nome?: string | null
          passageiro_id?: string
          status?: Database["public"]["Enums"]["corrida_status"]
          updated_at?: string
          valor_estimado?: number
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corridas_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corridas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corridas_passageiro_id_fkey"
            columns: ["passageiro_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_motorista: {
        Row: {
          created_at: string
          data_analise: string | null
          data_envio: string
          id: string
          motivo_recusa: string | null
          motorista_id: string
          status_analise: Database["public"]["Enums"]["documento_status_analise"]
          storage_path: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          data_analise?: string | null
          data_envio?: string
          id?: string
          motivo_recusa?: string | null
          motorista_id: string
          status_analise?: Database["public"]["Enums"]["documento_status_analise"]
          storage_path: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          data_analise?: string | null
          data_envio?: string
          id?: string
          motivo_recusa?: string | null
          motorista_id?: string
          status_analise?: Database["public"]["Enums"]["documento_status_analise"]
          storage_path?: string
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_motorista_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_motorista_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      enderecos_favoritos: {
        Row: {
          created_at: string
          endereco: string
          id: string
          latitude: number
          longitude: number
          nome: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          endereco: string
          id?: string
          latitude: number
          longitude: number
          nome: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          endereco?: string
          id?: string
          latitude?: number
          longitude?: number
          nome?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_favoritos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_suporte: {
        Row: {
          autor_admin_id: string | null
          autor_usuario_id: string | null
          chamado_id: string
          corpo: string
          created_at: string
          id: string
        }
        Insert: {
          autor_admin_id?: string | null
          autor_usuario_id?: string | null
          chamado_id: string
          corpo: string
          created_at?: string
          id?: string
        }
        Update: {
          autor_admin_id?: string | null
          autor_usuario_id?: string | null
          chamado_id?: string
          corpo?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_suporte_autor_admin_id_fkey"
            columns: ["autor_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_suporte_autor_usuario_id_fkey"
            columns: ["autor_usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_suporte_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_suporte"
            referencedColumns: ["id"]
          },
        ]
      }
      motorista_recusas: {
        Row: {
          corrida_id: string
          created_at: string | null
          id: string
          motorista_id: string
        }
        Insert: {
          corrida_id: string
          created_at?: string | null
          id?: string
          motorista_id: string
        }
        Update: {
          corrida_id?: string
          created_at?: string | null
          id?: string
          motorista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorista_recusas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorista_recusas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          chave_pix: string | null
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
          conta_mercado_pago_id: string | null
          created_at: string
          id: string
          is_disponivel: boolean
          nota_media: number | null
          status_aprovacao: Database["public"]["Enums"]["motorista_status_aprovacao"]
          tipo_chave_pix: Database["public"]["Enums"]["tipo_chave_pix"] | null
          ultima_lat: number | null
          ultima_lng: number | null
          ultima_localizacao_at: string | null
          updated_at: string
        }
        Insert: {
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          conta_mercado_pago_id?: string | null
          created_at?: string
          id: string
          is_disponivel?: boolean
          nota_media?: number | null
          status_aprovacao?: Database["public"]["Enums"]["motorista_status_aprovacao"]
          tipo_chave_pix?: Database["public"]["Enums"]["tipo_chave_pix"] | null
          ultima_lat?: number | null
          ultima_lng?: number | null
          ultima_localizacao_at?: string | null
          updated_at?: string
        }
        Update: {
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          conta_mercado_pago_id?: string | null
          created_at?: string
          id?: string
          is_disponivel?: boolean
          nota_media?: number | null
          status_aprovacao?: Database["public"]["Enums"]["motorista_status_aprovacao"]
          tipo_chave_pix?: Database["public"]["Enums"]["tipo_chave_pix"] | null
          ultima_lat?: number | null
          ultima_lng?: number | null
          ultima_localizacao_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          corrida_id: string | null
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          corrida_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          corrida_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          corrida_id: string
          created_at: string
          estornado_at: string | null
          id: string
          id_transacao_mercadopago: string | null
          meio: Database["public"]["Enums"]["forma_pagamento"]
          pago_at: string | null
          status: Database["public"]["Enums"]["pagamento_status"]
          updated_at: string
          valor_comissao: number
          valor_motorista: number
          valor_total: number
        }
        Insert: {
          corrida_id: string
          created_at?: string
          estornado_at?: string | null
          id?: string
          id_transacao_mercadopago?: string | null
          meio: Database["public"]["Enums"]["forma_pagamento"]
          pago_at?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor_comissao: number
          valor_motorista: number
          valor_total: number
        }
        Update: {
          corrida_id?: string
          created_at?: string
          estornado_at?: string | null
          id?: string
          id_transacao_mercadopago?: string | null
          meio?: Database["public"]["Enums"]["forma_pagamento"]
          pago_at?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor_comissao?: number
          valor_motorista?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_pix_device_sessions: {
        Row: {
          created_at: string
          device_id: string
          expires_at: string
          passageiro_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          expires_at: string
          passageiro_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          expires_at?: string
          passageiro_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_pix_device_sessions_passageiro_id_fkey"
            columns: ["passageiro_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_pix_tentativas: {
        Row: {
          approved_at: string | null
          created_at: string
          estado_interno: string
          expires_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          mercadopago_payment_id: string | null
          motorista_id: string
          pagamento_id: string
          pix_copia_cola: string | null
          provider_error_code: string | null
          provider_error_message: string | null
          provider_status: string | null
          provider_status_detail: string | null
          refunded_at: string | null
          ticket_url: string | null
          updated_at: string
          valor_comissao: number
          valor_total: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          estado_interno?: string
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          mercadopago_payment_id?: string | null
          motorista_id: string
          pagamento_id: string
          pix_copia_cola?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_status?: string | null
          provider_status_detail?: string | null
          refunded_at?: string | null
          ticket_url?: string | null
          updated_at?: string
          valor_comissao: number
          valor_total: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          estado_interno?: string
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          mercadopago_payment_id?: string | null
          motorista_id?: string
          pagamento_id?: string
          pix_copia_cola?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_status?: string | null
          provider_status_detail?: string | null
          refunded_at?: string | null
          ticket_url?: string | null
          updated_at?: string
          valor_comissao?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_pix_tentativas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_pix_tentativas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          auth_user_id: string | null
          celular: string | null
          cidade_id: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          is_motorista: boolean | null
          is_passageiro: boolean | null
          nome: string
          perfil_ativo: Database["public"]["Enums"]["user_profile_type"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          celular?: string | null
          cidade_id?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_motorista?: boolean | null
          is_passageiro?: boolean | null
          nome: string
          perfil_ativo?: Database["public"]["Enums"]["user_profile_type"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          celular?: string | null
          cidade_id?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_motorista?: boolean | null
          is_passageiro?: boolean | null
          nome?: string
          perfil_ativo?: Database["public"]["Enums"]["user_profile_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano: number
          ativo: boolean
          cor: string
          created_at: string
          id: string
          marca: string
          modelo: string
          motorista_id: string
          placa: string
          status_aprovacao: Database["public"]["Enums"]["veiculo_status_aprovacao"]
          updated_at: string
        }
        Insert: {
          ano: number
          ativo?: boolean
          cor: string
          created_at?: string
          id?: string
          marca: string
          modelo: string
          motorista_id: string
          placa: string
          status_aprovacao?: Database["public"]["Enums"]["veiculo_status_aprovacao"]
          updated_at?: string
        }
        Update: {
          ano?: number
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          motorista_id?: string
          placa?: string
          status_aprovacao?: Database["public"]["Enums"]["veiculo_status_aprovacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: true
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      viagens_compartilhadas: {
        Row: {
          corrida_id: string
          created_at: string
          expira_em: string
          id: string
          link_publico: string
        }
        Insert: {
          corrida_id: string
          created_at?: string
          expira_em: string
          id?: string
          link_publico?: string
        }
        Update: {
          corrida_id?: string
          created_at?: string
          expira_em?: string
          id?: string
          link_publico?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagens_compartilhadas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_corrida_atomic: {
        Args: { p_corrida_id: string; p_motorista_id: string }
        Returns: undefined
      }
      criar_corrida_financeira_atomica: {
        Args: {
          p_cidade_id: string
          p_codigo_embarque: string
          p_destino_lat: number
          p_destino_lng: number
          p_destino_nome: string
          p_forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          p_origem_lat: number
          p_origem_lng: number
          p_origem_nome: string
          p_passageiro_id: string
          p_valor_comissao: number
          p_valor_estimado: number
          p_valor_motorista: number
          p_valor_total: number
        }
        Returns: string
      }
      get_admin_id_by_auth: { Args: { auth_id: string }; Returns: string }
      get_distinct_ufs: {
        Args: never
        Returns: {
          estado_uf: string
        }[]
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      passageiro_tem_corrida_ativa_com_motorista: {
        Args: { p_motorista_id: string }
        Returns: boolean
      }
      pix_charge_attempt_claim: {
        Args: { _corrida_id: string; _motorista_id: string }
        Returns: {
          idempotency_key: string
          pagamento_id: string
          passageiro_id: string
          tentativa_id: string
          valor_comissao: number
          valor_total: number
        }[]
      }
      pix_charge_attempt_complete: {
        Args: {
          _expires_at: string
          _mercadopago_payment_id: string
          _pix_copia_cola: string
          _provider_status: string
          _provider_status_detail: string
          _tentativa_id: string
        }
        Returns: undefined
      }
      pix_charge_attempt_fail: {
        Args: { _provider_status_detail: string; _tentativa_id: string }
        Returns: boolean
      }
      pix_charge_failure_compensate: {
        Args: {
          _corrida_id: string
          _motorista_id: string
          _provider_status_detail: string
          _tentativa_id: string
        }
        Returns: boolean
      }
      pix_oauth_account_owner_claim: {
        Args: { _mercadopago_user_id: string; _motorista_id: string }
        Returns: string
      }
      pix_oauth_credentials_get: {
        Args: { _motorista_id: string }
        Returns: {
          access_token_encrypted: string
          connected_at: string
          connection_status: string
          encryption_version: number
          expires_at: string
          last_refreshed_at: string
          mercadopago_user_id: string
          motorista_id: string
          refresh_token_encrypted: string
          revoked_at: string
          scope: string
          token_type: string
        }[]
      }
      pix_oauth_credentials_revoke: {
        Args: { _motorista_id: string }
        Returns: boolean
      }
      pix_oauth_credentials_upsert: {
        Args: {
          _access_token_encrypted: string
          _encryption_version: number
          _expires_at: string
          _mercadopago_user_id: string
          _motorista_id: string
          _refresh_token_encrypted: string
          _scope?: string
          _token_type?: string
        }
        Returns: undefined
      }
      pix_oauth_disconnect_safe: {
        Args: { _motorista_id: string }
        Returns: string
      }
      pix_oauth_pending_authorization_cancel: {
        Args: { _motorista_id: string }
        Returns: boolean
      }
      pix_oauth_pending_authorization_confirm: {
        Args: { _motorista_id: string; _platform_mercadopago_user_id: string }
        Returns: string
      }
      pix_oauth_pending_authorization_status: {
        Args: { _motorista_id: string }
        Returns: string
      }
      pix_oauth_pending_authorization_summary: {
        Args: { _motorista_id: string }
        Returns: Json
      }
      pix_oauth_pending_authorization_upsert: {
        Args: {
          _access_token_encrypted: string
          _encryption_version: number
          _mercadopago_user_id: string
          _motorista_id: string
          _refresh_token_encrypted: string
          _scope?: string
          _token_expires_at: string
          _token_type?: string
        }
        Returns: string
      }
      pix_oauth_state_consume: {
        Args: { _motorista_id: string; _state_hash: string }
        Returns: {
          encrypted_code_verifier: string
          envelope_version: number
        }[]
      }
      pix_oauth_state_create: {
        Args: {
          _code_verifier_encrypted: string
          _encryption_version: number
          _expires_at: string
          _motorista_id: string
          _state_hash: string
        }
        Returns: string
      }
      pix_payment_status_project: {
        Args: {
          _mercadopago_payment_id: string
          _provider_status: string
          _provider_status_detail: string
          _tentativa_id: string
        }
        Returns: string
      }
      set_motorista_online_atomic: {
        Args: { p_motorista_id: string }
        Returns: string
      }
      submit_motorista_for_analysis: {
        Args: { p_auth_user_id: string }
        Returns: Json
      }
      suporte_arquivar_chamado_passageiro: {
        Args: { _auth_user_id: string; _chamado_id: string }
        Returns: undefined
      }
      suporte_fechar_chamado: {
        Args: { _admin_auth_id: string; _chamado_id: string }
        Returns: undefined
      }
      suporte_iniciar_atendimento: {
        Args: { _admin_auth_id: string; _chamado_id: string }
        Returns: undefined
      }
      suporte_reabrir_chamado: {
        Args: { _admin_auth_id: string; _chamado_id: string }
        Returns: undefined
      }
      suporte_resolver_chamado: {
        Args: {
          _admin_auth_id: string
          _chamado_id: string
          _mensagem_final: string
        }
        Returns: undefined
      }
      suporte_responder_chamado: {
        Args: { _admin_auth_id: string; _chamado_id: string; _corpo: string }
        Returns: undefined
      }
    }
    Enums: {
      cancelado_por: "passageiro" | "motorista" | "operacao"
      cidade_status: "em_breve" | "piloto" | "ativa"
      corrida_status:
        | "solicitada"
        | "buscando_motorista"
        | "aceita"
        | "motorista_a_caminho"
        | "motorista_chegou"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "sem_motorista"
        | "aguardando_pagamento"
      documento_status_analise:
        | "pendente"
        | "aprovado"
        | "recusado"
        | "correcao_solicitada"
      forma_pagamento: "pix" | "cartao" | "dinheiro"
      motorista_status:
        | "draft"
        | "under_review"
        | "approved"
        | "suspended"
        | "rejected"
        | "em_analise"
      motorista_status_aprovacao:
        | "em_preenchimento"
        | "em_analise"
        | "aprovado"
        | "recusado"
        | "suspenso"
      pagamento_status: "pendente" | "pago" | "falhou" | "estornado"
      status_chamado_suporte:
        | "aberto"
        | "em_atendimento"
        | "resolvido"
        | "fechado"
      tipo_chamado_suporte: "duvida" | "sos" | "reclamacao"
      tipo_chave_pix: "cpf" | "telefone" | "email" | "aleatoria"
      tipo_documento:
        | "identidade"
        | "cnh"
        | "comprovante_residencia"
        | "crlv"
        | "foto_veiculo"
        | "foto_placa"
      user_profile_type: "passageiro" | "motorista"
      veiculo_status_aprovacao:
        | "em_preenchimento"
        | "em_analise"
        | "aprovado"
        | "recusado"
        | "suspenso"
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
      cancelado_por: ["passageiro", "motorista", "operacao"],
      cidade_status: ["em_breve", "piloto", "ativa"],
      corrida_status: [
        "solicitada",
        "buscando_motorista",
        "aceita",
        "motorista_a_caminho",
        "motorista_chegou",
        "em_andamento",
        "concluida",
        "cancelada",
        "sem_motorista",
        "aguardando_pagamento",
      ],
      documento_status_analise: [
        "pendente",
        "aprovado",
        "recusado",
        "correcao_solicitada",
      ],
      forma_pagamento: ["pix", "cartao", "dinheiro"],
      motorista_status: [
        "draft",
        "under_review",
        "approved",
        "suspended",
        "rejected",
        "em_analise",
      ],
      motorista_status_aprovacao: [
        "em_preenchimento",
        "em_analise",
        "aprovado",
        "recusado",
        "suspenso",
      ],
      pagamento_status: ["pendente", "pago", "falhou", "estornado"],
      status_chamado_suporte: [
        "aberto",
        "em_atendimento",
        "resolvido",
        "fechado",
      ],
      tipo_chamado_suporte: ["duvida", "sos", "reclamacao"],
      tipo_chave_pix: ["cpf", "telefone", "email", "aleatoria"],
      tipo_documento: [
        "identidade",
        "cnh",
        "comprovante_residencia",
        "crlv",
        "foto_veiculo",
        "foto_placa",
      ],
      user_profile_type: ["passageiro", "motorista"],
      veiculo_status_aprovacao: [
        "em_preenchimento",
        "em_analise",
        "aprovado",
        "recusado",
        "suspenso",
      ],
    },
  },
} as const
