---
name: SSR Authentication and Admin Guard
description: Implement full SSR authentication using cookies for Supabase and a robust server-side admin guard to eliminate the redirection loop and ensure security.
type: feature
---
# SSR Authentication and Admin Guard

Implement robust authentication for SSR loaders using Supabase cookies and a unified server-side destination resolver.

## Technical Details

1.  **SSR Authentication with Cookies**:
    - Update `src/integrations/supabase/client.ts` to use cookies for session persistence in addition to localStorage.
    - Update `src/lib/auth-status.server.ts` to extract the session from the cookie in the request headers instead of relying on the `Authorization` header, which is missing during initial SSR loads.

2.  **Unified Destination Resolver**:
    - Refactor `src/lib/auth-status.functions.ts` to ensure `resolveDestinationForLoader` uses the cookie-based auth context.
    - Ensure all redirects are handled server-side within TanStack Start loaders to prevent "flashes" or client-side loops.

3.  **Admin Security**:
    - Verify `mokahz@gmail.com` exclusively via server-side token validation.
    - Maintain `requireAdmin` middleware for all sensitive administrative operations.

4.  **Operational Flow**:
    - Unauthenticated: Redirect to `/auth/login`.
    - Admin: Redirect to `/admin`.
    - User (incomplete): Redirect to `/auth/completar-cadastro`.
    - User (no profile): Redirect to `/auth/perfil`.
    - User (complete): Redirect to `/` or `/onboarding-motorista`.
