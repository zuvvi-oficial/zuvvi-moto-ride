import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getStatusConexaoMercadoPago,
  iniciarConexaoMercadoPago,
} from '@/lib/motorista-pagamento.functions';

export default function MercadoPagoConnect() {
  const getStatusFn = useServerFn(getStatusConexaoMercadoPago);
  const iniciarFn = useServerFn(iniciarConexaoMercadoPago);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mercadopago-conexao'],
    queryFn: () => getStatusFn(),
  });

  const conectar = async () => {
    setErro(null);
    setIsRedirecting(true);
    try {
      const { url, state } = await iniciarFn();
      window.sessionStorage.setItem('zuvvi_mp_oauth_state', state);
      window.location.href = url;
    } catch {
      setErro('Não foi possível iniciar a conexão. Tente novamente.');
      setIsRedirecting(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4 font-poppins">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zuvvi-volt/10 flex items-center justify-center border border-white/10">
          <Wallet className="w-5 h-5 text-zuvvi-volt" />
        </div>
        <div>
          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Recebimentos</p>
          <h3 className="text-sm font-bold uppercase italic">Conta Mercado Pago</h3>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 text-zuvvi-volt animate-spin" />
        </div>
      ) : data?.conectado ? (
        <div className="flex items-center gap-3 bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-zuvvi-volt shrink-0" />
          <p className="text-xs font-bold uppercase tracking-widest text-zuvvi-volt">
            Conta Mercado Pago conectada
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-white/60">
            Conecte sua conta Mercado Pago para receber os pagamentos das suas corridas.
          </p>
          <Button
            onClick={conectar}
            disabled={isRedirecting}
            className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
          >
            {isRedirecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Conectar conta Mercado Pago'
            )}
          </Button>
          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>
      )}
    </div>
  );
}
