import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

export const Route = createFileRoute('/diagnostico-teclado')({
  component: DiagnosticoTeclado,
});

// Página temporária, sem autenticação, que replica a estrutura EXATA de
// header/main/nav position:fixed da tela de início (src/routes/index.tsx)
// — mesmo código de medição via ResizeObserver — com um overlay ao vivo
// mostrando onde cada elemento realmente está na tela. Usada pra investigar
// o bug do header/menu se deslocando com o teclado. Remover depois.
function DiagnosticoTeclado() {
  const [query, setQuery] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    const headerEl = headerRef.current;
    const navEl = navRef.current;
    if (!headerEl || !navEl || typeof ResizeObserver === 'undefined') return;
    const headerObserver = new ResizeObserver(() => setHeaderHeight(headerEl.getBoundingClientRect().height));
    const navObserver = new ResizeObserver(() => setNavHeight(navEl.getBoundingClientRect().height));
    headerObserver.observe(headerEl);
    navObserver.observe(navEl);
    return () => {
      headerObserver.disconnect();
      navObserver.disconnect();
    };
  }, []);

  // Overlay de diagnóstico: mede tudo a cada 300ms (não só em eventos),
  // pra pegar qualquer estado intermediário durante a animação do teclado.
  const [debug, setDebug] = useState('');
  useEffect(() => {
    const tick = () => {
      const h = headerRef.current?.getBoundingClientRect();
      const n = navRef.current?.getBoundingClientRect();
      const vv = window.visualViewport;
      setDebug(
        `innerH=${window.innerHeight} vvH=${vv ? Math.round(vv.height) : '-'} vvOffsetTop=${vv ? Math.round(vv.offsetTop) : '-'}\n` +
        `header top=${h ? Math.round(h.top) : '-'} bottom=${h ? Math.round(h.bottom) : '-'} (deveria top=0)\n` +
        `nav top=${n ? Math.round(n.top) : '-'} bottom=${n ? Math.round(n.bottom) : '-'} (deveria bottom=innerH)`
      );
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative bg-zuvvi-indigo text-foreground" style={{ height: '100dvh', width: '100vw' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }} className="bg-zuvvi-indigo-dark" />

      <main
        className="fixed inset-x-0 z-10 overflow-y-auto overscroll-contain"
        style={{ top: headerHeight, bottom: navHeight }}
      >
        <div className="min-h-full flex flex-col justify-end px-5 pb-4 mx-auto w-full max-w-md space-y-4">
          <div className="space-y-4">
            <div className="bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl space-y-3">
              <p className="text-sm font-bold">Card de origem (exemplo)</p>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Toque aqui pra abrir o teclado"
              className="w-full bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 py-6 pl-6 pr-4 rounded-[2rem] text-base"
            />
          </div>
        </div>
      </main>

      <header ref={headerRef} className="fixed top-0 inset-x-0 z-20 px-5 py-4">
        <div className="mx-auto max-w-md flex items-center justify-between bg-zuvvi-indigo/60 backdrop-blur-lg border border-white/10 rounded-3xl px-4 py-3 shadow-2xl">
          <p className="text-sm font-bold">CABEÇALHO (deve ficar sempre aqui)</p>
        </div>
      </header>

      <nav ref={navRef} className="fixed bottom-0 inset-x-0 z-20 bg-zuvvi-indigo/80 backdrop-blur-xl border-t border-white/10 px-5 py-4">
        <div className="mx-auto max-w-md flex items-center justify-around">
          <span className="text-sm font-black volt-text">MENU (deve ficar sempre aqui embaixo)</span>
        </div>
      </nav>

      {/* Overlay de diagnóstico — por cima de tudo, sem empurrar nada */}
      <pre
        style={{
          position: 'fixed', top: '90px', left: '8px', right: '8px', zIndex: 999,
          background: 'rgba(0,0,0,0.85)', color: '#C6FF3D', fontSize: '11px',
          padding: '8px', margin: 0, whiteSpace: 'pre-wrap', pointerEvents: 'none',
          borderRadius: '8px',
        }}
      >
        {debug}
      </pre>
    </div>
  );
}
