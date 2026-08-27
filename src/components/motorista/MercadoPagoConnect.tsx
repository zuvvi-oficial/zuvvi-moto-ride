import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Loader2, CheckCircle2, Settings2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  desconectarMercadoPago,
  getStatusConexaoMercadoPago,
  iniciarConexaoMercadoPago,
} from '@/lib/motorista-pagamento.functions';

export default function MercadoPagoConnect() {
  const queryClient = useQueryClient();
  const getStatusFn = useServerFn(getStatusConexaoMercadoPago);
  const iniciarFn = useServerFn(iniciarConexaoMercadoPago);
  const desconectarFn = useServerFn(desconectarMercadoPago);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mercadopago-conexao'],
    queryFn: () => getStatusFn(),
  });

  const conectar = async () => {
    setErro(null);
    setSucesso(null);
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

  const trocarContaMercadoPago = () => {
    window.open('https://www.mercadopago.com.br/', '_blank', 'noopener,noreferrer');
  };

  const desconectar = async () => {
    setErro(null);
    setSucesso(null);
    setIsDisconnecting(true);
    try {
      await desconectarFn();
      queryClient.setQueryData(['mercadopago-conexao'], { conectado: false });
      setSucesso('Conta Mercado Pago desconectada com sucesso.');
      void queryClient.invalidateQueries({ queryKey: ['mercadopago-conexao'] });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível desconectar a conta. Tente novamente.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!isLoading && data?.conectado) {
    return (
      <div className="space-y-2 font-poppins">
        <div className="flex items-center justify-between gap-3 px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-zuvvi-volt" />
            <p className="truncate text-xs font-bold text-zuvvi-volt">Mercado Pago conectado</p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isDisconnecting}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold uppercase tracking-wider text-white/60 transition-colors hover:text-zuvvi-volt disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Gerenciar conta Mercado Pago"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Settings2 className="h-3.5 w-3.5" />
                )}
                Gerenciar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-zuvvi-indigo text-white font-poppins">
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar conta Mercado Pago?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  Você não poderá mais receber pagamentos via Pix até conectar novamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={desconectar}
                  className="bg-red-600 text-white hover:bg-red-500"
                >
                  Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {erro && <p className="px-1 text-xs text-red-500">{erro}</p>}
      </div>
    );
  }

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
      ) : (
        <div className="space-y-3">
          {sucesso && <p className="text-xs font-bold text-zuvvi-volt">{sucesso}</p>}
          <p className="text-xs text-white/60">
            Conecte sua conta Mercado Pago para receber os pagamentos das suas corridas.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isRedirecting}
                className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
              >
                {isRedirecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : sucesso ? (
                  'Conectar outra conta Mercado Pago'
                ) : (
                  'Conectar conta Mercado Pago'
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-zuvvi-indigo text-white font-poppins">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar conta Mercado Pago</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  O Mercado Pago pode reutilizar automaticamente a conta que já estiver aberta neste navegador. Se quiser vincular outra conta, abra o Mercado Pago abaixo, saia da conta atual e entre na conta correta antes de continuar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-2">
                <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  Cancelar
                </AlertDialogCancel>
                <Button
                  type="button"
                  variant="outline"
                  onClick={trocarContaMercadoPago}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Abrir Mercado Pago e trocar conta
                </Button>
                <AlertDialogAction
                  onClick={conectar}
                  className="bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90"
                >
                  Usar a conta já aberta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>
      )}
    </div>
  );
}
