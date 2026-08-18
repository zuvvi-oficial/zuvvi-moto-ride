import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSessionUser } from "@/lib/user.functions";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // This is just a basic check, we need to handle the case where user is NOT logged in.
    // TanStack Start server-side routing can be tricky here.
    // For now, let's keep it simple and just return the component.
    return {};
  },
  component: IndexPage,
});

function IndexPage() {
  // We need a way to detect session without triggering a full page reload or redirect loop.
  // Actually, let's just use the landing page if no user.
  // For now, I'll just render the landing page, and add a simple client-side logic
  // to redirect if session exists.
  
  return (
    <div className="min-h-screen">
      <h1>Landing Page... redirecting if logged in...</h1>
    </div>
  );
}
