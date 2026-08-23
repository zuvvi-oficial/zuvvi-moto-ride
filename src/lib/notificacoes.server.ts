import { SupabaseClient } from "@supabase/supabase-js";

type TipoNotificacao = 
  | "motorista_aceitou"
  | "motorista_a_caminho"
  | "motorista_chegou"
  | "corrida_iniciada"
  | "corrida_concluida"
  | "corrida_cancelada"
  | "nova_oferta_corrida"
  | "documento_aprovado"
  | "documento_recusado"
  | "motorista_aprovado";

export async function criarNotificacao(
  supabase: SupabaseClient<any>,
  params: {
    usuario_id: string;
    tipo: TipoNotificacao;
    titulo: string;
    mensagem: string;
    corrida_id?: string | null;
  }
) {
  try {
    const { error } = await supabase
      .from("notificacoes")
      .insert({
        usuario_id: params.usuario_id,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        corrida_id: params.corrida_id || null,
        lida: false
      });

    if (error) {
      console.error("Erro ao criar notificação:", error);
    }
  } catch (err) {
    console.error("Erro inesperado ao criar notificação:", err);
  }
}
