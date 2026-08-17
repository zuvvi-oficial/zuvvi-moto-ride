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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      motoristas: {
        Row: {
          chave_pix: string | null
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
          conta_mercado_pago_id: string | null
          created_at: string
          id: string
          nota_media: number
          status_aprovacao: Database["public"]["Enums"]["motorista_status_aprovacao"]
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
          nota_media?: number
          status_aprovacao?: Database["public"]["Enums"]["motorista_status_aprovacao"]
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
          nota_media?: number
          status_aprovacao?: Database["public"]["Enums"]["motorista_status_aprovacao"]
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
      usuarios: {
        Row: {
          auth_user_id: string | null
          celular: string | null
          cidade_id: string | null
          cpf: string
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
          cpf: string
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
          cpf?: string
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
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      cidade_status: "em_breve" | "piloto" | "ativa"
      motorista_status:
        | "draft"
        | "under_review"
        | "approved"
        | "suspended"
        | "rejected"
      motorista_status_aprovacao:
        | "em_preenchimento"
        | "em_analise"
        | "aprovado"
        | "recusado"
        | "suspenso"
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
      cidade_status: ["em_breve", "piloto", "ativa"],
      motorista_status: [
        "draft",
        "under_review",
        "approved",
        "suspended",
        "rejected",
      ],
      motorista_status_aprovacao: [
        "em_preenchimento",
        "em_analise",
        "aprovado",
        "recusado",
        "suspenso",
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
