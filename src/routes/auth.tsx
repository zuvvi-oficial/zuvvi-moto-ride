import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-asphalt flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 ember-glow">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tighter text-amber-500 font-space">
            ZUVVI
          </h1>
          <p className="text-zinc-400 mt-2 text-sm uppercase tracking-widest font-medium">
            Mobilidade Urbana
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
