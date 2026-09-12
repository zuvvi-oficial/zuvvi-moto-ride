import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

export const Route = createFileRoute('/diagnostico-teclado')({
  component: DiagnosticoTeclado,
});

// Página temporária, sem autenticação, só pra descobrir na prática como o
// navegador do aparelho do usuário reporta window.visualViewport quando o
// teclado abre — usada pra investigar o bug do header/menu na tela de
// início. Remover depois que o diagnóstico terminar.
function DiagnosticoTeclado() {
  const [innerHeight, setInnerHeight] = useState(0);
  const [vv, setVv] = useState<{ height: number; offsetTop: number; width: number } | null>(null);
  const [hasVv, setHasVv] = useState(true);
  const [events, setEvents] = useState<string[]>([]);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    setInnerHeight(window.innerHeight);
    const vvApi = window.visualViewport;
    setHasVv(!!vvApi);
    if (!vvApi) return;

    const log = (tipo: string) => {
      const t = ((Date.now() - startRef.current) / 1000).toFixed(1);
      setEvents((prev) => [
        `${t}s [${tipo}] h=${Math.round(vvApi.height)} offsetTop=${Math.round(vvApi.offsetTop)} innerHeight=${window.innerHeight}`,
        ...prev,
      ].slice(0, 30));
    };

    const sync = (tipo: string) => {
      setVv({ height: vvApi.height, offsetTop: vvApi.offsetTop, width: vvApi.width });
      setInnerHeight(window.innerHeight);
      log(tipo);
    };

    sync('inicial');
    const onResize = () => sync('resize');
    const onScroll = () => sync('scroll');
    vvApi.addEventListener('resize', onResize);
    vvApi.addEventListener('scroll', onScroll);
    window.addEventListener('resize', () => sync('window-resize'));

    return () => {
      vvApi.removeEventListener('resize', onResize);
      vvApi.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: '#130F36', color: 'white', fontFamily: 'monospace', padding: '16px', fontSize: '15px', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
        Diagnóstico — teclado e viewport
      </h1>

      <p style={{ background: 'rgba(198,255,61,0.15)', border: '1px solid rgba(198,255,61,0.4)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
        1. Toque no campo abaixo pra abrir o teclado.<br />
        2. Espere 1 segundo.<br />
        3. Tire um print desta tela (com o teclado aberto) e manda pro Claude.
      </p>

      <input
        type="text"
        placeholder="Toque aqui pra abrir o teclado"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px',
          fontSize: '16px',
          borderRadius: '12px',
          border: '2px solid #C6FF3D',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          marginBottom: '16px',
        }}
      />

      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
        <p><b>window.visualViewport existe?</b> {hasVv ? 'SIM' : 'NÃO (isso já seria a causa)'}</p>
        <p><b>window.innerHeight:</b> {innerHeight}px</p>
        {vv && (
          <>
            <p><b>visualViewport.height:</b> {Math.round(vv.height)}px</p>
            <p><b>visualViewport.offsetTop:</b> {Math.round(vv.offsetTop)}px</p>
            <p><b>visualViewport.width:</b> {Math.round(vv.width)}px</p>
          </>
        )}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
        <p style={{ marginBottom: '8px' }}><b>Histórico de eventos (mais recente primeiro):</b></p>
        {events.length === 0 && <p style={{ opacity: 0.5 }}>Nenhum evento ainda — toque no campo acima.</p>}
        {events.map((e, i) => (
          <p key={i} style={{ fontSize: '12px', opacity: 0.85, margin: '2px 0' }}>{e}</p>
        ))}
      </div>

      <p style={{ marginTop: '16px', fontSize: '11px', opacity: 0.5 }}>
        {typeof navigator !== 'undefined' ? navigator.userAgent : ''}
      </p>
    </div>
  );
}
