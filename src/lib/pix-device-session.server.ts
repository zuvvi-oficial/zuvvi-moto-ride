function normalizePixDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 512) return null;
  if (/\p{Cc}/u.test(normalized)) return null;
  return normalized;
}

export async function obterPixDeviceIdValido(
  supabaseAdmin: any,
  passageiroId: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("pagamentos_pix_device_sessions")
    .select("device_id, expires_at")
    .eq("passageiro_id", passageiroId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const deviceId = normalizePixDeviceId(data?.device_id);
  if (error || !deviceId) {
    throw new Error("Não foi possível validar a segurança do Pix. Tente solicitar a corrida novamente.");
  }

  return deviceId;
}
