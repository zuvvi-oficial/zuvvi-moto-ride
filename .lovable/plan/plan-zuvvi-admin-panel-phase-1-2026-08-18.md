# Plan: Zuvvi Admin Panel Phase 1

Implement the first functional version of the Zuvvi administrative panel for managing driver and vehicle approvals, following strict security protocols and a dedicated permission system.

## User Review Required

> [!IMPORTANT]
> To bootstrap the first administrator, please provide the **e-mail address** of the account that should have admin access. This account must already exist (or be created) via the normal login flow (Google/Email).

## Technical Details

### 1. Database Schema
- Create `public.admin_users` table for internal permissions.
- Create `public.admin_audit_logs` table for tracking administrative actions.
- Enable RLS on both tables with strict `service_role` and `admin` access policies.
- Idempotent migration for structure and audit triggers.

### 2. Security Infrastructure
- Implement `requireAdmin` server-side middleware for TanStack server functions.
- Use `supabaseAdmin` for administrative operations (approval/rejection) to bypass RLS when acting as a validated admin.
- No admin UI components visible to regular users.

### 3. Server Functions (`src/lib/admin.functions.ts`)
- `getAdminStats`: Fetches dashboard counts (pending drivers, vehicles, online status).
- `getPendingDrivers`: Fetches list of drivers awaiting analysis.
- `getPendingVehicles`: Fetches list of vehicles awaiting analysis.
- `approveDriver` / `rejectDriver` / `suspendDriver`: Updates status and logs audit.
- `approveVehicle` / `rejectVehicle` / `suspendVehicle`: Updates status and logs audit.

### 4. Admin Routes
- `/admin`: Dashboard with key metrics.
- `/admin/motoristas`: Management of driver accounts (analysis, documents, vehicles).
- `/admin/veiculos`: Management of vehicle records.
- Protected by a route gate that redirects unauthorized users.

### 5. Integration Changes
- Update `toggleDisponibilidade` (driver side) to strictly check the new approval statuses managed by the admin panel.

## Implementation Steps

1. **Database Migration**: Create tables, RLS, and a temporary placeholder or seed for the admin user (once e-mail is provided).
2. **Server Logic**: Create `admin.functions.ts` and `admin.server.ts` (for audit helpers).
3. **UI Components**: Build administrative-themed components (separate from public UI).
4. **Routes**: Implement the `/admin` route tree.
5. **Verification**: Test access control and state transitions.
