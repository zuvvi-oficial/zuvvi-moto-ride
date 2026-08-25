import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Loader2, CheckCircle2, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { concluirConexaoMercadoPagoPixSegura } from '@/lib/pix-mercadopago-oauth.functions';

export const Route = createFileRoute('/motorista/mercadopago-callback')({
  head: () => ({
    meta: [
      { title: 'Conectando conta Mercado Pago | Zuvvi' },
      {
        name: 'description',
        content:
          'Finalizando a conexão da sua conta Mercado Pago para receber pagamentos das corridas Zuvvi.',
      },
      { property: 'og:title', content: 'Conectando conta Mercado Pago | Zuvvi' },
      {
        property: 'og:description',
        content: 'Finalizando a conexão da conta Mercado Pago do mototaxista Zuvvi.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: MercadoPagoCallback,
});

function MercadoPagoCallback() {
  const navigate = useNavigate();
  const concluirFn = useServerFn(concluirConexaoMercadoPagoPixSegura);
  const [status, setStatus] = useState<'processando' | 'sucesso' | 'erro'>('processando');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      setStatus('erro');
      return;
    }

    concluirFn({ data: { code, state } })
      .then(() => setStatus('sucesso'))
      .catch(() => setStatus('erro'));
  }, [concluirFn]);

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex items-center justify-center p-6 font-poppins">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
        {status === 'processando' && (
          <>
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin mx-auto" />
            <h1 className="text-lg font-bold uppercase italic">Conectando conta</h1>
            <p className="text-sm text-white/60">Estamos finalizando a conexão com o Mercado Pago.</p>
          </>
        )}

        {status === 'sucesso' && (
          <>
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Conta Mercado Pago conectada</h1>
            <p className="text-sm text-white/60">Você já pode receber os pagamentos das corridas.</p>
            <Button
              onClick={() => navigate({ to: '/onboarding-motorista' })}
              className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Voltar
            </Button>
          </>
        )}

        {status === 'erro' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Falha na conexão</h1>
            <p className="text-sm text-white/60">
              Não foi possível concluir a conexão com o Mercado Pago. Tente novamente.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/onboarding-motorista' })}
              className="w-full h-12 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
