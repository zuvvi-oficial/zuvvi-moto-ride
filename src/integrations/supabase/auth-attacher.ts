import { createMiddleware } from '@tanstack/react-start'
import { supabase } from './client'

// Nomes de cookies padronizados para Supabase Auth via @supabase/ssr
const ACCESS_TOKEN_COOKIE = 'sb-access-token';
const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

/**
 * Utilitário para gerenciar cookies no navegador.
 */
function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  document.cookie = `${name}=${value}; path=/; expires=${expires}; SameSite=Lax; Secure`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax; Secure`;
}

/**
 * Sincroniza a sessão do Supabase com cookies Http para o servidor (SSR).
 */
export function syncAuthSessionToCookies(session: any) {
  if (!session) {
    removeCookie(ACCESS_TOKEN_COOKIE);
    removeCookie(REFRESH_TOKEN_COOKIE);
    return;
  }

  const { access_token, refresh_token, expires_in } = session;
  // Gravamos os cookies para o servidor ler
  setCookie(ACCESS_TOKEN_COOKIE, access_token, expires_in || 3600);
  if (refresh_token) {
    setCookie(REFRESH_TOKEN_COOKIE, refresh_token, 30 * 24 * 3600); // 30 dias
  }
}

/**
 * Middleware para anexar o token de autorização em chamadas de função de servidor (RPC).
 */
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const token = session?.access_token;

    // Sincronização proativa
    syncAuthSessionToCookies(session);
    
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
