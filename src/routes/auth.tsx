import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8 zuvvi-glow">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tighter volt-text">
            ZUVVI
          </h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-widest font-medium">
            Mobilidade Urbana
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
