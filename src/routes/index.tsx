import { createFileRoute } from "@tanstack/react-router";
import heroMoto from "@/assets/hero-moto.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Zuvvi — Mobilidade urbana na velocidade da moto",
      },
      {
        name: "description",
        content:
          "Zuvvi é a plataforma brasileira de moto-táxi. Corridas rápidas, ágeis e confiáveis para se mover pela cidade.",
      },
      {
        property: "og:title",
        content: "Zuvvi — Mobilidade urbana na velocidade da moto",
      },
      {
        property: "og:description",
        content:
          "Plataforma brasileira de moto-táxi. Corridas rápidas, ágeis e confiáveis pela cidade.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: heroMoto },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: heroMoto },
    ],
  }),
  component: Index,
});

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold tracking-tight ${className}`}
      style={{ letterSpacing: "-0.04em" }}
    >
      <span className="ember-text">Zu</span>
      <span>vvi</span>
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </span>
  );
}

const values = [
  {
    title: "Veloz",
    desc: "Chegue mais rápido. A moto atravessa o trânsito e encurta a cidade.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Confiável",
    desc: "Motoristas verificados e corrida rastreada do início ao fim.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Simples",
    desc: "Peça a corrida em poucos toques. Preço justo e sem surpresas.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function Index() {
  return (
    <div className="min-h-screen asphalt-gradient text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#sobre" className="transition-colors hover:text-foreground">
              Sobre
            </a>
            <a href="#valores" className="transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#contato" className="transition-colors hover:text-foreground">
              Contato
            </a>
          </nav>
          <span className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider ember-text">
            Em breve
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="speed-lines absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-16 sm:pt-24 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-28">
          <div className="animate-rise">
            <Pill>
              <span className="h-1.5 w-1.5 rounded-full bg-ember" />
              Moto-táxi no Brasil
            </Pill>
            <h1 className="mt-6 text-balance font-display text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
              Mobilidade urbana na{" "}
              <span className="ember-text">velocidade da moto</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              O Zuvvi conecta você a mototaxistas verificados para cruzar a
              cidade rápido, com segurança e preço justo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#contato"
                className="ember-glow inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Quero saber mais
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a
                href="#valores"
                className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Como funciona
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-border/80 ember-glow">
              <img
                src={heroMoto}
                alt="Mototaxista do Zuvvi atravessa a cidade ao entardecer"
                width={1920}
                height={1280}
                className="aspect-[4/3] w-full object-cover"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-asphalt-deep via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-asphalt-deep/80 px-4 py-3 backdrop-blur-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-ember" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
                </span>
                <span className="text-sm font-medium text-cream">
                  Pronto para acelerar
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="border-y border-border/60 bg-secondary/30 py-4">
          <div className="flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {Array.from({ length: 2 }).map((_, dup) => (
                <div key={dup} className="flex shrink-0 items-center gap-10 pr-10">
                  <span>Ágil</span><span className="ember-text">•</span>
                  <span>Seguro</span><span className="ember-text">•</span>
                  <span>Urbano</span><span className="ember-text">•</span>
                  <span>Brasil</span><span className="ember-text">•</span>
                  <span>Moto-táxi</span><span className="ember-text">•</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section id="valores" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.4fr] lg:gap-16">
          <div>
            <Pill>
              <span className="h-1.5 w-1.5 rounded-full bg-ember" />
              Por que Zuvvi
            </Pill>
            <h2 className="mt-6 text-balance font-display text-4xl font-bold leading-tight sm:text-5xl">
              Feito para a rua, <br className="hidden sm:block" />
              desenhado para a cidade.
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground">
              O Zuvvi nasce da realidade do transporte urbano brasileiro:
              poucos minutos a mais fazem diferença, e a moto encurta o caminho.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {values.map((v) => (
              <div
                key={v.title}
                className="group rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-ember/50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember/12 ember-text">
                  {v.icon}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre / manifesto */}
      <section id="sobre" className="border-y border-border/60 bg-secondary/20">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Pill>
                <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                Manifesto
              </Pill>
              <h2 className="mt-6 text-balance font-display text-4xl font-bold leading-tight sm:text-5xl">
                Cada minuto na cidade vale a pena.
              </h2>
            </div>
            <div className="space-y-5 text-muted-foreground">
              <p>
                O trânsito não espera e a vida também não. O Zuvvi nasce para
                devolver tempo às pessoas — levando-as de um ponto a outro com
                a agilidade que só a moto oferece, sem abrir mão da segurança.
              </p>
              <p>
                Estamos construindo, no Brasil, uma nova forma de se mover:
                mais humana para quem corre, mais justa para quem pede a
                corrida e mais transparente para a cidade.
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                Zuvvi. A cidade no ritmo da moto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contato / CTA final */}
      <section id="contato" className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-asphalt-deep px-6 py-14 text-center sm:px-12">
          <div className="speed-lines absolute inset-0 opacity-30" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-bold leading-tight sm:text-5xl">
              Em breve, a cidade corre com a gente.
            </h2>
            <p className="mt-5 text-muted-foreground">
              O Zuvvi está em construção. Logo você poderá pedir sua corrida de
              moto-táxi em poucos toques.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="ember-glow inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-primary-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-primary-foreground" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
                </span>
                Lançamento em breve
              </span>
              <Wordmark className="text-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
          <div className="flex items-center gap-2">
            <Wordmark className="text-xl" />
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Zuvvi Mobilidade
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Plataforma de moto-táxi · Brasil
          </p>
        </div>
      </footer>
    </div>
  );
}
