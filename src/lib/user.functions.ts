import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { nanoid } from "nanoid";

const RIDE_SEARCH_TIMEOUT_MS = 120_000;

// Etapa 3 do motorista favorito: janela curta em que só o favorito
// escolhido pode ver/aceitar a corrida, antes de virar oferta geral.
const FAVORITO_PRIORIDADE_JANELA_MS = 15_000;

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];

type MotoristaRow = Database["public"]["Tables"]["motoristas"]["Row"];

export type UserWithMotorista = UserRow & {
  motorista: MotoristaRow | null;
};

export const getSessionUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserWithMotorista> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("*, motorista:motoristas(*), cidade:cidades(nome, estado_uf)")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !user) {
      throw new Error("Usuário não encontrado");
    }

    const motoristaData = Array.isArray(user.motorista) ? user.motorista[0] : user.motorista;

    return {
      ...user,
      motorista: (motoristaData as MotoristaRow) || null
    } as UserWithMotorista;
  });

export const getMapboxToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = process.env['MAPBOX_TOKEN'] || null;
    return token;
  });

const cityAvailabilitySchema = z.object({
  coords: z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180)
  }).optional()
});

type OriginAvailabilityReason =
  | "location_required"
  | "city_not_configured"
  | "city_unavailable"
  | "location_not_identified"
  | "outside_registered_city";

type OriginAvailabilityResult = {
  isAvailable: boolean;
  cityName: string | null;
  status: Database["public"]["Enums"]["cidade_status"] | null;
  reason: OriginAvailabilityReason | null;
};

const normalizeCityName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

async function resolveOriginAvailability(
  supabaseAdmin: any,
  authUserId: string,
  coords?: { lat: number; lng: number },
): Promise<OriginAvailabilityResult> {
  if (!coords) {
    return {
      isAvailable: false,
      cityName: null,
      status: null,
      reason: "location_required",
    };
  }

  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("cidade_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (usuarioError || !usuario?.cidade_id) {
    return {
      isAvailable: false,
      cityName: null,
      status: null,
      reason: "city_not_configured",
    };
  }

  const { data: cidade, error: cidadeError } = await supabaseAdmin
    .from("cidades")
    .select("status, nome, estado_uf")
    .eq("id", usuario.cidade_id)
    .maybeSingle();

  if (cidadeError || !cidade) {
    return {
      isAvailable: false,
      cityName: null,
      status: null,
      reason: "city_not_configured",
    };
  }

  const cityEnabled = cidade.status === "piloto" || cidade.status === "ativa";
  if (!cityEnabled) {
    return {
      isAvailable: false,
      cityName: cidade.nome,
      status: cidade.status,
      reason: "city_unavailable",
    };
  }

  const token = process.env['MAPBOX_TOKEN'];
  if (!token) {
    return {
      isAvailable: false,
      cityName: null,
      status: null,
      reason: "location_not_identified",
    };
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${encodeURIComponent(token)}&language=pt&types=place&limit=1`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        isAvailable: false,
        cityName: null,
        status: null,
        reason: "location_not_identified",
      };
    }

    const json = await response.json() as {
      features?: Array<{
        text?: string;
        text_pt?: string;
        context?: Array<{
          id?: string;
          short_code?: string;
        }>;
      }>;
    };

    const feature = json.features?.[0];
    const detectedCity = feature?.text_pt || feature?.text || null;
    const region = feature?.context?.find((item) => item.id?.startsWith("region."));
    const detectedUf = region?.short_code?.split("-").pop()?.toUpperCase() || null;

    if (!detectedCity || !detectedUf) {
      return {
        isAvailable: false,
        cityName: null,
        status: null,
        reason: "location_not_identified",
      };
    }

    const sameCity =
      normalizeCityName(detectedCity) === normalizeCityName(cidade.nome) &&
      detectedUf === cidade.estado_uf.toUpperCase();

    if (!sameCity) {
      return {
        isAvailable: false,
        cityName: `${detectedCity}, ${detectedUf}`,
        status: null,
        reason: "outside_registered_city",
      };
    }

    return {
      isAvailable: true,
      cityName: cidade.nome,
      status: cidade.status,
      reason: null,
    };
  } catch {
    return {
      isAvailable: false,
      cityName: null,
      status: null,
      reason: "location_not_identified",
    };
  }
}

export const checkCityAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cityAvailabilitySchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return resolveOriginAvailability(supabaseAdmin, context.userId, data.coords);
  });

const cotarCorridaSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  destinoLat: z.number(),
  destinoLng: z.number()
});

// Núcleo de cotarCorrida, sem a assinatura HMAC (que só faz sentido pra
// proteger uma cotação que vai e volta pelo cliente). Reaproveitado pelo
// motor de corrida agendada (corridas-agendadas-engine.server.ts), que
// precisa recalcular o preço na hora da conversão — nunca usar um preço
// "congelado" de quando o agendamento foi criado.
export async function cotarCorridaCore(
  supabaseAdmin: any,
  authUserId: string,
  params: { origemLat: number; origemLng: number; destinoLat: number; destinoLng: number },
) {
  const originAvailability = await resolveOriginAvailability(
    supabaseAdmin,
    authUserId,
    { lat: params.origemLat, lng: params.origemLng },
  );

  if (!originAvailability.isAvailable) {
    if (originAvailability.reason === "outside_registered_city") {
      throw new Error("A origem selecionada está fora da sua cidade de operação.");
    }
    if (originAvailability.reason === "city_unavailable") {
      throw new Error("O Zuvvi ainda não opera na sua cidade.");
    }
    throw new Error("Não foi possível confirmar a cidade da origem. Tente novamente.");
  }

  // 1. Obter tarifas da cidade do usuário
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("cidade_id")
    .eq("auth_user_id", authUserId)
    .single();

  if (!usuario?.cidade_id) throw new Error("Cidade não identificada.");

  const { data: cidade } = await supabaseAdmin
    .from("cidades")
    .select("bandeirada, valor_km, valor_min, tarifa_minima")
    .eq("id", usuario.cidade_id)
    .single();

  if (!cidade) throw new Error("Tarifas não encontradas.");

  // 2. Calcular rota oficial via Mapbox
  const token = process.env['MAPBOX_TOKEN'];
  if (!token) throw new Error("Serviço de rotas indisponível.");

  const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${params.origemLng},${params.origemLat};${params.destinoLng},${params.destinoLat}?geometries=geojson&access_token=${token}`;

  const resp = await fetch(directionsUrl);
  const routeData = await resp.json();
  if (routeData.code !== 'Ok' || !routeData.routes?.[0]) {
    throw new Error("Não foi possível calcular o trajeto.");
  }
  const route = routeData.routes[0];

  // 3. Calcular valor oficial
  const distanceKm = route.distance / 1000;
  const durationMin = route.duration / 60;
  let valor = Number(cidade.bandeirada) + (distanceKm * Number(cidade.valor_km)) + (durationMin * Number(cidade.valor_min));
  if (valor < Number(cidade.tarifa_minima)) valor = Number(cidade.tarifa_minima);
  valor = Math.round(valor * 100) / 100;

  return {
    distanceKm,
    durationMin,
    valor,
    tarifas: {
      bandeirada: Number(cidade.bandeirada),
      valorKm: Number(cidade.valor_km),
      valorMin: Number(cidade.valor_min),
      tarifaMinima: Number(cidade.tarifa_minima),
    },
    geometry: route.geometry,
  };
}

export const cotarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cotarCorridaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("crypto");

    const cotacao = await cotarCorridaCore(supabaseAdmin, context.userId, data);

    // Gerar Assinatura da Cotação (Anti-Tampering)
    // Validade implícita: a cotação deve bater com os dados da corrida.
    // Distância/duração/tarifa entram na assinatura para que a corrida possa
    // gravar exatamente o que foi cotado (G3), sem confiar em valores soltos
    // que o cliente poderia reenviar adulterados.
    const { bandeirada, valorKm, valorMin, tarifaMinima } = cotacao.tarifas;
    const payload = `${data.origemLat}:${data.origemLng}:${data.destinoLat}:${data.destinoLng}:${cotacao.valor}:${cotacao.distanceKm}:${cotacao.durationMin}:${bandeirada}:${valorKm}:${valorMin}:${tarifaMinima}`;
    const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'zuvvi-internal';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return {
      distance: cotacao.distanceKm,
      duration: cotacao.durationMin,
      valor: cotacao.valor,
      tarifas: cotacao.tarifas,
      signature,
      geometry: cotacao.geometry
    };
  });

const createRideSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  origemNome: z.string().optional(),
  destinoLat: z.number(),
  destinoLng: z.number(),
  destinoNome: z.string().optional(),
  formaPagamento: z.enum(["pix", "cartao", "dinheiro"]),
  valorCotado: z.number(),
  distanciaKm: z.number(),
  duracaoMin: z.number(),
  tarifaBandeirada: z.number(),
  tarifaValorKm: z.number(),
  tarifaValorMin: z.number(),
  tarifaMinima: z.number(),
  assinaturaCotacao: z.string(),
  cupomCodigo: z.string().trim().min(1).max(40).optional(),
});

// Núcleo de criarCorrida, sem a validação de assinatura HMAC (que só faz
// sentido pra proteger uma cotação que passou pelo cliente). Reaproveitado
// pelo motor de corrida agendada, que cota e cria a corrida na mesma
// chamada server-side — não há cliente nem round-trip a proteger contra
// adulteração ali.
export type CriarCorridaCoreParams = Omit<z.infer<typeof createRideSchema>, "assinaturaCotacao">;

export async function criarCorridaCore(supabaseAdmin: any, authUserId: string, data: CriarCorridaCoreParams) {
    const crypto = await import("crypto");

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, cidade_id")
      .eq("auth_user_id", authUserId)
      .single();

    if (!usuario) throw new Error("Usuário não encontrado.");

    // [3.8-C1] Limpeza e [3.8-A] Verificação de aberta
    const timeoutCutoff = new Date(Date.now() - RIDE_SEARCH_TIMEOUT_MS).toISOString();
    await supabaseAdmin
      .from("corridas")
      .update({ status: 'sem_motorista' } as any)
      .eq("passageiro_id", usuario.id)
      .eq("status", "solicitada")
      .is("motorista_id", null)
      .lte("created_at", timeoutCutoff);

    const { data: corridaAberta } = await supabaseAdmin
      .from("corridas")
      .select("id")
      .eq("passageiro_id", usuario.id)
      .in("status", ['solicitada', 'buscando_motorista', 'aguardando_pagamento', 'aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento'])
      .limit(1)
      .maybeSingle();

    if (corridaAberta) throw new Error("Você já possui uma corrida em andamento.");

    if (!usuario.cidade_id) throw new Error("Cidade não configurada.");

    const { data: cidade } = await supabaseAdmin
      .from("cidades")
      .select("status, comissao_pct")
      .eq("id", usuario.cidade_id)
      .single();

    if (!cidade || (cidade.status !== 'piloto' && cidade.status !== 'ativa')) {
      throw new Error("O Zuvvi ainda não opera nesta cidade.");
    }

    const codigoEmbarque = crypto.randomInt(1000, 10000).toString();
    const comissaoPct = Number(cidade.comissao_pct || 0);
    const comissaoOriginal = Math.round((data.valorCotado * (comissaoPct / 100)) * 100) / 100;
    const valorMotorista = Math.round((data.valorCotado - comissaoOriginal) * 100) / 100;

    // Cupom de desconto (Etapa 2): nunca confia num valor de desconto vindo
    // do cliente — revalida tudo de novo aqui, contra o valorCotado real
    // desta corrida. O desconto sai inteiro da comissão da Zuvvi, nunca do
    // repasse do motorista (mesma filosofia da gorjeta: o motorista nunca
    // paga o preço de uma promoção) — por isso é limitado ao tamanho da
    // própria comissão dessa corrida. Numa cidade com comissão baixa ou
    // zero, um cupom pode não render desconto nenhum; nesse caso a corrida
    // segue sem aplicar o cupom.
    let cupomId: string | null = null;
    let valorDescontoAplicado = 0;
    if (data.cupomCodigo) {
      const { avaliarCupomParaCorrida } = await import("./cupons.functions");
      const avaliacao = await avaliarCupomParaCorrida(supabaseAdmin, {
        codigo: data.cupomCodigo,
        usuarioId: usuario.id,
        cidadeId: usuario.cidade_id,
        valorCorrida: data.valorCotado,
      });
      const descontoLimitadoPelaComissao = Math.min(avaliacao.valorDesconto, comissaoOriginal);
      if (descontoLimitadoPelaComissao <= 0) {
        throw new Error("Este cupom não pôde ser aplicado a esta corrida.");
      }
      cupomId = avaliacao.cupomId;
      valorDescontoAplicado = descontoLimitadoPelaComissao;
    }

    const valorComissao = Math.round((comissaoOriginal - valorDescontoAplicado) * 100) / 100;
    const valorTotal = Math.round((valorMotorista + valorComissao) * 100) / 100;

    // A RPC é versionada nesta microetapa. O cast fica restrito a esta chamada
    // enquanto os tipos gerados refletem apenas o schema atualmente em produção.
    const { data: corridaId, error: atomicError } = await (supabaseAdmin as any).rpc(
      "criar_corrida_financeira_atomica",
      {
        p_passageiro_id: usuario.id,
        p_cidade_id: usuario.cidade_id,
        p_origem_lat: data.origemLat,
        p_origem_lng: data.origemLng,
        p_destino_lat: data.destinoLat,
        p_destino_lng: data.destinoLng,
        p_valor_estimado: valorTotal,
        p_forma_pagamento: data.formaPagamento,
        p_codigo_embarque: codigoEmbarque,
        p_origem_nome: data.origemNome || 'Sua localização',
        p_destino_nome: data.destinoNome || 'Destino',
        p_valor_total: valorTotal,
        p_valor_motorista: valorMotorista,
        p_valor_comissao: valorComissao,
        p_distancia_km: data.distanciaKm,
        p_duracao_min: data.duracaoMin,
        p_tarifa_bandeirada: data.tarifaBandeirada,
        p_tarifa_valor_km: data.tarifaValorKm,
        p_tarifa_valor_min: data.tarifaValorMin,
        p_tarifa_minima: data.tarifaMinima
      }
    );

    if (atomicError || !corridaId) {
      if (atomicError?.code === "23505") {
        throw new Error("Você já possui uma corrida ativa.");
      }
      console.error("Erro criação financeira atômica:", atomicError);
      throw new Error("Falha ao registrar a corrida.");
    }

    // A corrida já foi criada com sucesso nesse ponto (com o desconto já
    // aplicado no valor cobrado) — o que importa pro passageiro já
    // aconteceu. Registrar o uso do cupom é só bookkeeping: uma falha aqui
    // (ex.: corrida de uma race rara batendo no limite do cupom bem nesse
    // instante) nunca deve reverter ou cancelar a corrida já criada, só
    // ficar visível pra reconciliação manual.
    if (cupomId) {
      const { error: cupomUsoError } = await supabaseAdmin.from("cupom_usos").insert({
        cupom_id: cupomId,
        usuario_id: usuario.id,
        corrida_id: corridaId,
        valor_desconto: valorDescontoAplicado,
      } as any);
      if (cupomUsoError) {
        console.error(
          "[Cupons] Corrida criada com desconto aplicado, mas falha ao registrar o uso do cupom — requer reconciliação manual.",
          { corridaId, cupomId, motivo: cupomUsoError.message },
        );
      }
    }

    // Avisar motoristas elegíveis da cidade sobre a nova oferta (push + sino).
    // Best-effort e isolado em try/catch: a corrida já foi criada com sucesso
    // acima, então uma falha aqui nunca deve derrubar a resposta ao passageiro.
    // A elegibilidade completa (CNH, veículo, documentos) já é reforçada de
    // novo no aceite (evaluateMotoristaOperationalEligibility em aceitarCorrida),
    // então aqui basta o filtro operacional básico (online, aprovado, GPS
    // recente) — o mesmo já usado em getOfertasDisponiveis.
    try {
      const { criarNotificacao } = await import("./notificacoes.server");
      const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);

      // Etapa 3 do motorista favorito: se algum motorista favoritado por esse
      // passageiro estiver disponível agora nesta mesma cidade, ele recebe a
      // oferta primeiro — o mais próximo, se houver mais de um — com uma
      // janela curta antes de virar oferta geral (getOfertasDisponiveis e
      // accept_corrida_atomic reforçam essa mesma janela).
      let favoritoEscolhidoId: string | null = null;
      // Corrida já foi resolvida (aceita por outro motorista ou expirou) no
      // intervalo entre a criação e a escolha do favorito — não há mais nada
      // a notificar, nem para o favorito, nem em broadcast (achado do Codex
      // no PR #64, P2: sem isso o UPDATE abaixo, sem filtro de status,
      // sobrescreveria motorista_favorito_id numa corrida já aceita).
      let corridaJaResolvida = false;
      try {
        const { data: favoritos } = await supabaseAdmin
          .from("motoristas_favoritos")
          .select(
            "motorista_id, motoristas!inner(is_disponivel, status_aprovacao, ultima_localizacao_at, ultima_lat, ultima_lng, usuarios!inner(cidade_id, auth_user_id))",
          )
          .eq("passageiro_id", usuario.id);

        const favoritosDisponiveis = (favoritos || [])
          .map((f: any) => ({ id: f.motorista_id as string, m: f.motoristas }))
          .filter(
            ({ m }: any) =>
              m?.is_disponivel === true &&
              m?.status_aprovacao === "aprovado" &&
              m?.usuarios?.cidade_id === usuario.cidade_id &&
              !!m?.ultima_localizacao_at &&
              new Date(m.ultima_localizacao_at) >= cincoMinutosAtras,
          );

        // Achado do Codex no PR #64, P2: o filtro acima não bastava para
        // garantir que o favorito escolhido de fato conseguiria ver/aceitar
        // a oferta — precisa da mesma elegibilidade operacional completa
        // (CNH, veículo, documentos) usada em aceitarCorrida, e de conexão
        // Pix válida quando a corrida é Pix (mesmo filtro de
        // getOfertasDisponiveis). Sem isso, um favorito inelegível travaria
        // a janela toda sem ninguém poder aceitar.
        const favoritosElegiveis: typeof favoritosDisponiveis = [];
        if (favoritosDisponiveis.length > 0) {
          const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");
          let getPixStatus: typeof import("./pix-mercadopago-account.server").getPixMercadoPagoSecureConnectionStatus | null = null;
          if (data.formaPagamento === "pix") {
            ({ getPixMercadoPagoSecureConnectionStatus: getPixStatus } = await import(
              "./pix-mercadopago-account.server"
            ));
          }

          for (const candidato of favoritosDisponiveis) {
            const authUserId = candidato.m?.usuarios?.auth_user_id as string | undefined;
            if (!authUserId) continue;

            try {
              const elegibilidade = await evaluateMotoristaOperationalEligibility(supabaseAdmin, authUserId);
              if (!elegibilidade.eligible) continue;
            } catch {
              continue;
            }

            if (getPixStatus) {
              try {
                const statusPix = await getPixStatus(supabaseAdmin as any, candidato.id);
                if (!statusPix.conectado) continue;
              } catch {
                continue;
              }
            }

            favoritosElegiveis.push(candidato);
          }
        }

        if (favoritosElegiveis.length > 0) {
          const comCoordenadas = favoritosElegiveis.filter(
            ({ m }: any) => Number.isFinite(m.ultima_lat) && Number.isFinite(m.ultima_lng),
          );
          const ordenados =
            comCoordenadas.length > 0
              ? [...comCoordenadas].sort(
                  (a: any, b: any) =>
                    haversineMetros(data.origemLat, data.origemLng, a.m.ultima_lat, a.m.ultima_lng) -
                    haversineMetros(data.origemLat, data.origemLng, b.m.ultima_lat, b.m.ultima_lng),
                )
              : favoritosElegiveis;
          const escolhido = ordenados[0] as { id: string };

          // Achado do Codex no PR #64, P2: este UPDATE precisa dos mesmos
          // filtros de status/motorista_id usados no resto do sistema — sem
          // eles, se a corrida já tiver sido aceita por outro motorista
          // (poll de 5s dele pode ter batido bem nesta janela), este UPDATE
          // sobrescreveria a corrida já aceita com um motorista_favorito_id
          // e notificaria o favorito sobre uma corrida que não existe mais.
          const { data: prioridadeRows, error: prioridadeError } = await supabaseAdmin
            .from("corridas")
            .update({
              motorista_favorito_id: escolhido.id,
              prioridade_favorito_expira_em: new Date(Date.now() + FAVORITO_PRIORIDADE_JANELA_MS).toISOString(),
            } as any)
            .eq("id", corridaId as string)
            .eq("status", "solicitada")
            .is("motorista_id", null)
            .select("id");

          if (prioridadeError) {
            console.error("Erro ao gravar prioridade do motorista favorito:", prioridadeError);
          } else if (!prioridadeRows || prioridadeRows.length === 0) {
            corridaJaResolvida = true;
          } else {
            favoritoEscolhidoId = escolhido.id;
            await criarNotificacao(supabaseAdmin, {
              usuario_id: escolhido.id,
              tipo: "nova_oferta_corrida",
              titulo: "⭐ Um passageiro que já andou com você está te chamando!",
              mensagem: `Passageiro esperando em ${data.origemNome || "sua região"}.`,
              corrida_id: corridaId as string,
            });
          }
        }
      } catch (err) {
        console.error("Erro ao priorizar motorista favorito:", err);
      }

      // Sem favorito disponível: broadcast normal para todos os elegíveis da
      // cidade, como sempre funcionou. Com favorito: só ele é avisado agora;
      // os demais passam a ver a corrida (via getOfertasDisponiveis) quando a
      // janela de prioridade expirar. Se a corrida já foi resolvida enquanto
      // escolhíamos o favorito, não há mais nada a notificar.
      if (!favoritoEscolhidoId && !corridaJaResolvida) {
        const { data: candidatos } = await supabaseAdmin
          .from("usuarios")
          .select("id, motoristas!inner(is_disponivel, status_aprovacao, ultima_localizacao_at)")
          .eq("cidade_id", usuario.cidade_id)
          .eq("is_motorista", true);

        const motoristasElegiveis = (candidatos || []).filter((candidato: any) => {
          const motorista = candidato.motoristas;
          return (
            motorista?.is_disponivel === true &&
            motorista?.status_aprovacao === "aprovado" &&
            !!motorista?.ultima_localizacao_at &&
            new Date(motorista.ultima_localizacao_at) >= cincoMinutosAtras
          );
        });

        await Promise.allSettled(
          motoristasElegiveis.map((candidato: any) =>
            criarNotificacao(supabaseAdmin, {
              usuario_id: candidato.id,
              tipo: "nova_oferta_corrida",
              titulo: "🔔 Nova corrida disponível!",
              mensagem: `Passageiro esperando em ${data.origemNome || "sua região"}.`,
              corrida_id: corridaId as string,
            }),
          ),
        );
      }
    } catch (err) {
      console.error("Erro ao notificar motoristas sobre nova oferta:", err);
    }

    return { success: true, rideId: corridaId as string };
}

export const criarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRideSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("crypto");

    // Validar Assinatura da Cotação (mesmo payload assinado em cotarCorrida,
    // incluindo distância/duração/tarifa para gravar exatamente o que foi cotado — G3).
    const payload = `${data.origemLat}:${data.origemLng}:${data.destinoLat}:${data.destinoLng}:${data.valorCotado}:${data.distanciaKm}:${data.duracaoMin}:${data.tarifaBandeirada}:${data.tarifaValorKm}:${data.tarifaValorMin}:${data.tarifaMinima}`;
    const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'zuvvi-internal';
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (data.assinaturaCotacao !== expectedSignature) {
      throw new Error("Cotação inválida ou expirada. Recalcule o valor da corrida.");
    }

    return criarCorridaCore(supabaseAdmin, context.userId, data);
  });

export const getCorrida = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Obter a corrida com os IDs necessários para validação
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .select(`
        *,
        usuarios!corridas_passageiro_id_fkey(auth_user_id),
        motoristas!corridas_motorista_id_fkey(
          usuarios(auth_user_id)
        )
      `)
      .eq("id", data.rideId)
      .maybeSingle();

    if (error || !corrida) {
      throw new Error("Corrida não encontrada");
    }

    // 2. Validação de Autorização
    const passageiroAuthId = (corrida.usuarios as any)?.auth_user_id;
    const motoristaAuthId = (corrida.motoristas as any)?.usuarios?.auth_user_id;

    const isPassageiro = authUserId === passageiroAuthId;
    const isMotorista = motoristaAuthId && authUserId === motoristaAuthId;

    if (!isPassageiro && !isMotorista) {
      // Erro genérico para não confirmar a existência da corrida a terceiros
      throw new Error("Corrida não encontrada");
    }

    // 3. Remover dados de join usados apenas para validação antes de retornar
    const { usuarios, motoristas, ...rideData } = corrida as any;
    
    return rideData;
  });


export const getRetomadaCorridaPassageiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) {
      throw new Error("Usuário não encontrado");
    }

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, status, forma_pagamento, motorista_id")
      .eq("passageiro_id", usuario.id)
      .in("status", [
        "solicitada",
        "buscando_motorista",
        "aguardando_pagamento",
        "aceita",
        "motorista_a_caminho",
        "motorista_chegou",
        "em_andamento"
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (corridaError) {
      throw new Error("Falha ao consultar corrida em andamento");
    }

    if (!corrida) return null;

    const motoristaAtribuido = Boolean(corrida.motorista_id);
    const tela = !motoristaAtribuido
      ? "procurando_motorista"
      : corrida.forma_pagamento === "pix"
        ? "pagamento_pix"
        : "acompanhamento";

    return {
      rideId: corrida.id,
      tela
    } as const;
  });

export const getReverseGeocoding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const token = process.env['MAPBOX_TOKEN'];
    if (!token) throw new Error("Token do Mapbox não configurado");

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${data.lng},${data.lat}.json?access_token=${token}&language=pt&limit=1`;
    
    try {
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.features && json.features.length > 0) {
        // Retorna o place_name formatado (ex: Rua X, Bairro, Cidade)
        return { address: json.features[0].place_name };
      }
      
      return { address: "Localização desconhecida" };
    } catch (err) {
      console.error("Erro reverse geocoding:", err);
      return { address: "Sua localização" };
    }
  });

export const verificarTimeoutCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado");

    const { data: corrida, error: rideError } = await supabaseAdmin
      .from("corridas")
      .select("id, status, motorista_id, created_at, passageiro_id")
      .eq("id", data.rideId)
      .maybeSingle();

    if (rideError || !corrida) throw new Error("Corrida não encontrada");
    if (corrida.passageiro_id !== usuario.id) throw new Error("Corrida não encontrada");

    if (corrida.status !== "solicitada" || corrida.motorista_id !== null) {
      return { expired: false, status: corrida.status };
    }

    const createdAt = new Date(corrida.created_at).getTime();
    const now = Date.now();
    const isExpired = (now - createdAt) >= RIDE_SEARCH_TIMEOUT_MS;

    if (!isExpired) return { expired: false, status: corrida.status };

    const cutoff = new Date(now - RIDE_SEARCH_TIMEOUT_MS).toISOString();
    const { data: updatedRide, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({ status: "sem_motorista" } as any)
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .eq("status", "solicitada")
      .is("motorista_id", null)
      .lte("created_at", cutoff)
      .select("status")
      .maybeSingle();

    if (updateError) throw new Error("Falha ao processar expiração.");

    if (!updatedRide) {
      const { data: finalRide, error: finalError } = await supabaseAdmin
        .from("corridas")
        .select("status")
        .eq("id", data.rideId)
        .maybeSingle();

      if (finalError) throw new Error("Falha ao consultar estado da corrida.");
      if (!finalRide) throw new Error("Corrida não encontrada");

      return { expired: false, status: finalRide.status };
    }

    return { expired: true, status: "sem_motorista" };
  });

export const cancelarCorrida = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { criarNotificacao } = await import("./notificacoes.server");
    const userId = context.userId;

    // 1. Obter o ID do perfil do usuário logado
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!usuario) {
      throw new Error("Perfil de usuário não encontrado.");
    }

    // O status da corrida sozinho NÃO é um proxy confiável de "pagamento Pix
    // confirmado": accept_corrida_atomic grava 'aceita' antes da cobrança Pix
    // ser criada (migration 20260825092700_pix_cobranca_apos_aceite.sql), e o
    // trigger atual (pix_guard_operational_before_payment_trigger, migration
    // 20260826164927_pix_operational_gate_keep_accept.sql) só bloqueia a
    // transição de 'aceita'/'aguardando_pagamento' para os estados seguintes
    // até o pagamento ser confirmado — ele não impede a corrida de estar em
    // 'aceita' com pagamento ainda pendente. Por isso o bloqueio de
    // cancelamento consulta pagamentos.status diretamente. Antes do aceite
    // (solicitada/buscando_motorista) nenhuma cobrança Pix existe ainda, então
    // o cancelamento continua livre nesses estados sem precisar consultar nada.
    const { data: corridaAlvo } = await supabaseAdmin
      .from("corridas")
      .select("forma_pagamento")
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .maybeSingle();

    if (corridaAlvo?.forma_pagamento === "pix") {
      const { data: pagamentoPix } = await supabaseAdmin
        .from("pagamentos")
        .select("status")
        .eq("corrida_id", data.rideId)
        .eq("meio", "pix")
        .maybeSingle();

      if (pagamentoPix?.status === "pago") {
        throw new Error(
          "Esta corrida já tem o pagamento Pix confirmado e não pode ser cancelada por aqui. Entre em contato com o suporte Zuvvi.",
        );
      }
    }

    // 2. Tentar atualizar a corrida se pertencer ao passageiro e status for válido
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'cancelada',
        cancelado_por: 'passageiro',
        data_cancelamento: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .in("status", ['solicitada', 'buscando_motorista', 'aceita', 'motorista_a_caminho'])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erro ao cancelar corrida:", error);
      throw new Error("Falha ao cancelar a corrida no banco de dados.");
    }

    if (!corrida) {
      throw new Error("Esta corrida não pode mais ser cancelada porque já avançou de etapa.");
    }

    // Encerrar (marcar como 'falhou') qualquer pagamento em dinheiro/cartão
    // ainda pendente desta corrida agora cancelada — sem isso o pagamento
    // ficava "pendente" para sempre no banco mesmo com a corrida já morta.
    // Deliberadamente EXCLUI Pix (achado do Codex no PR #53): um pagamento
    // Pix "pendente" pode ter uma cobrança ainda viva no Mercado Pago, que o
    // passageiro consegue pagar mesmo depois deste cancelamento. Marcar
    // 'falhou' aqui sem antes invalidar a cobrança no provedor faria
    // sincronizarPagamentoPixComMercadoPago descartar silenciosamente uma
    // aprovação tardia (ela já para na primeira checagem de status 'falhou'),
    // arriscando cobrar o passageiro por uma corrida cancelada sem nenhum
    // registro de conciliação. Invalidar a cobrança Pix no provedor antes
    // de marcar 'falhou' ainda não tem um caminho implementado e ligado ao
    // app — por isso Pix fica de fora aqui, propositalmente, até que exista.
    // Best-effort: um erro aqui é só logado, nunca desfaz o cancelamento já
    // confirmado.
    const { error: pagamentoCleanupError } = await supabaseAdmin
      .from("pagamentos")
      .update({ status: "falhou", updated_at: new Date().toISOString() })
      .eq("corrida_id", data.rideId)
      .eq("status", "pendente")
      .neq("meio", "pix");

    if (pagamentoCleanupError) {
      console.error(
        "Erro ao encerrar pagamento pendente da corrida cancelada:",
        pagamentoCleanupError,
      );
    }

    // Notificar Motorista se houver
    if (corrida.motorista_id) {
      await criarNotificacao(supabaseAdmin, {
        usuario_id: corrida.motorista_id,
        tipo: "corrida_cancelada",
        titulo: "❌ Corrida cancelada",
        mensagem: "O passageiro cancelou a corrida solicitada.",
        corrida_id: data.rideId
      });
    }

    return { success: true };
  });

export const getAcompanhamentoPassageiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Resolver o perfil public.usuarios (ownership)
    const { data: usuarioAuth, error: userAuthError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userAuthError || !usuarioAuth) {
      throw new Error("Corrida não encontrada.");
    }

    // 2. Buscar a corrida
    const { data: corrida, error: rideError } = await supabaseAdmin
      .from("corridas")
      .select(`
        id,
        status,
        origem_lat,
        origem_lng,
        origem_nome,
        destino_lat,
        destino_lng,
        destino_nome,
        valor_estimado,
        forma_pagamento,
        passageiro_id,
        motorista_id,
        codigo_embarque
      `)
      .eq("id", data.rideId)
      .maybeSingle();

    if (rideError || !corrida) {
      throw new Error("Corrida não encontrada.");
    }

    // Validação de ownership
    if (corrida.passageiro_id !== usuarioAuth.id) {
      throw new Error("Corrida não encontrada.");
    }

    const assignedStatuses: Database["public"]["Enums"]["corrida_status"][] = [
      "aceita",
      "motorista_a_caminho",
      "motorista_chegou",
      "em_andamento",
      "concluida"
    ];

    // Status deve estar entre os autorizados
    if (!assignedStatuses.includes(corrida.status)) {
      return {
        ride: null,
        driver: null,
        vehicle: null,
        handoffAvailable: false
      };
    }

    // Fail-closed: motorista_id deve existir
    if (!corrida.motorista_id) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    // 3. Buscar Mototaxista (FAIL-CLOSED)
    const { data: driver, error: driverError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id,
        nome,
        motoristas!inner (
          nota_media,
          ultima_lat,
          ultima_lng,
          created_at
        )
      `)
      .eq("id", corrida.motorista_id)
      .maybeSingle();

    // Fail-closed: consulta sem erro e nome não vazio
    if (driverError || !driver || !driver.nome || driver.nome.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const motoristaData = Array.isArray(driver.motoristas) ? driver.motoristas[0] : driver.motoristas;

    // 3.1 Contar corridas concluídas (fail-safe)
    let totalCorridas = 0;
    try {
      const { count } = await supabaseAdmin
        .from("corridas")
        .select("*", { count: 'exact', head: true })
        .eq("motorista_id", corrida.motorista_id)
        .eq("status", "concluida");
      totalCorridas = count || 0;
    } catch (err) {
      console.error("Erro ao contar corridas do motorista:", err);
    }

    const driverInfo = {
      id: driver.id,
      nome: driver.nome,
      nota_media: motoristaData?.nota_media ?? null,
      ultima_lat: motoristaData?.ultima_lat ?? null,
      ultima_lng: motoristaData?.ultima_lng ?? null,
      total_corridas: totalCorridas,
      membro_desde: motoristaData?.created_at ?? null
    };

    // 4. Buscar Veículo (FAIL-CLOSED: EXATAMENTE UM)
    const { data: vehicles, error: vehicleError } = await supabaseAdmin
      .from("veiculos")
      .select("marca, modelo, cor, placa")
      .eq("motorista_id", corrida.motorista_id)
      .eq("ativo", true)
      .eq("status_aprovacao", "aprovado");

    // Fail-closed: consulta sem erro e exatamente um registro
    if (vehicleError || !vehicles || vehicles.length !== 1) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const vehicle = vehicles[0];
    if (!vehicle) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    // Fail-closed: marca, modelo e placa não podem estar vazios
    const vMarca = vehicle.marca;
    const vModelo = vehicle.modelo;
    const vPlaca = vehicle.placa;

    if (!vMarca || !vModelo || !vPlaca || 
        vMarca.trim() === "" || vModelo.trim() === "" || vPlaca.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const vehicleInfo = {
      marca: vMarca,
      modelo: vModelo,
      cor: vehicle.cor ?? null,
      placa: vPlaca
    };

    // 5. Retorno Final Seguro
    return {
      ride: {
        id: corrida.id,
        status: corrida.status,
        origem_lat: corrida.origem_lat,
        origem_lng: corrida.origem_lng,
        origem_nome: corrida.origem_nome,
        destino_lat: corrida.destino_lat,
        destino_lng: corrida.destino_lng,
        destino_nome: corrida.destino_nome,
        valor_estimado: corrida.valor_estimado,
        forma_pagamento: corrida.forma_pagamento,
        codigo_embarque: corrida.status === 'motorista_chegou' ? corrida.codigo_embarque : null
      },
      driver: driverInfo,
      vehicle: vehicleInfo,
      handoffAvailable: true
    };
  });