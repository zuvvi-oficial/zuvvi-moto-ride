import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ZuvviLogo } from '@/components/brand/ZuvviLogo';

export const Route = createFileRoute('/auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8 zuvvi-glow">
        <div className="mb-8 flex justify-center">
          <ZuvviLogo surface="dark" className="h-auto w-full max-w-[240px]" />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
