import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelarAutorizacaoPendenteMercadoPagoPixSegura,
  confirmarConexaoMercadoPagoPixSegura,
  concluirConexaoMercadoPagoPixSegura,
  getAutorizacaoPendenteMercadoPagoPixSegura,
} from "@/lib/pix-mercadopago-oauth.functions";

export const Route = createFileRoute("/motorista/mercadopago-callback")({
  head: () => ({
    meta: [
      { title: "Autorizando conta Mercado Pago | Zuvvi" },
      {
        name: "description",
        content:
          "Validando com segurança a autorização da conta Mercado Pago antes da confirmação do motorista.",
      },
      { property: "og:title", content: "Autorizando conta Mercado Pago | Zuvvi" },
      {
        property: "og:description",
        content: "Validando a autorização da conta Mercado Pago do mototaxista Zuvvi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MercadoPagoCallback,
});

type CallbackStatus =
  "processando" | "pendente" | "confirmando" | "cancelando" | "troca" | "conectado" | "erro";

type PendingView = Readonly<{
  accountHint: string;
  reconexao: boolean;
}>;

function MercadoPagoCallback() {
  const navigate = useNavigate();
  const concluirFn = useServerFn(concluirConexaoMercadoPagoPixSegura);
  const getPendingFn = useServerFn(getAutorizacaoPendenteMercadoPagoPixSegura);
  const confirmarFn = useServerFn(confirmarConexaoMercadoPagoPixSegura);
  const cancelarFn = useServerFn(cancelarAutorizacaoPendenteMercadoPagoPixSegura);
  const [status, setStatus] = useState<CallbackStatus>("processando");
  const [pendencia, setPendencia] = useState<PendingView | null>(null);
  const [erro, setErro] = useState(
    "Não foi possível validar a autorização com o Mercado Pago. Tente novamente.",
  );

  useEffect(() => {
    let ativo = true;

    const recuperarPendencia = async () => {
      try {
        const resultado = await getPendingFn();
        if (!ativo) return;
        if (!resultado.pendente) {
          setPendencia(null);
          setStatus("erro");
          return;
        }

        setPendencia({
          accountHint: resultado.accountHint,
          reconexao: resultado.reconexao,
        });
        setStatus("pendente");
      } catch {
        if (ativo) setStatus("erro");
      }
    };

    const concluir = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (!code || !state) {
        await recuperarPendencia();
        return;
      }

      try {
        const resultado = await concluirFn({ data: { code, state } });
        if (!ativo) return;
        if (resultado.pending !== true) {
          setStatus("erro");
          return;
        }
        await recuperarPendencia();
      } catch {
        await recuperarPendencia();
      }
    };

    void concluir();

    return () => {
      ativo = false;
    };
  }, [concluirFn, getPendingFn]);

  const confirmar = async () => {
    setErro("Não foi possível confirmar a conexão com o Mercado Pago. Tente novamente.");
    setStatus("confirmando");

    try {
      const resultado = await confirmarFn();
      if (resultado.conectado) {
        setStatus("conectado");
        return;
      }

      if (resultado.motivo === "expirada") {
        setErro("A autorização expirou. Inicie a conexão com o Mercado Pago novamente.");
      } else if (resultado.motivo === "conta_de_outro_motorista") {
        setErro("Esta conta Mercado Pago já está vinculada a outro motorista Zuvvi.");
      } else if (resultado.motivo === "conta_da_plataforma") {
        setErro(
          "Esta é a conta Mercado Pago da plataforma Zuvvi e não pode receber corridas como conta de motorista.",
        );
      } else {
        setErro("Não há uma autorização pendente para confirmar. Inicie a conexão novamente.");
      }
      setStatus("erro");
    } catch {
      setStatus("erro");
    }
  };

  const trocarConta = async () => {
    setErro("Não foi possível cancelar esta autorização. Tente novamente.");
    setStatus("cancelando");

    try {
      await cancelarFn();
      setPendencia(null);
      setStatus("troca");
    } catch {
      setStatus("erro");
    }
  };

  const abrirMercadoPago = () => {
    window.open("https://www.mercadopago.com.br/", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex items-center justify-center p-6 font-poppins">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
        {status === "processando" && (
          <>
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin mx-auto" />
            <h1 className="text-lg font-bold uppercase italic">Validando autorização</h1>
            <p className="text-sm text-white/60">
              Estamos validando com segurança o retorno do Mercado Pago.
            </p>
          </>
        )}

        {status === "pendente" && pendencia && (
          <>
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">
              {pendencia.reconexao ? "Reconectar conta?" : "Autorização recebida"}
            </h1>
            <p className="text-sm font-bold text-zuvvi-volt">
              Conta autorizada: final ••••{pendencia.accountHint}
            </p>
            <p className="text-sm text-white/60">
              {pendencia.reconexao
                ? "Esta é uma conta que já pertenceu ao seu cadastro Zuvvi. Ela continua desconectada até você confirmar a reconexão."
                : "O Mercado Pago autorizou o acesso, mas esta conta ainda não está conectada. Confirme abaixo somente se esta é a conta correta para receber suas corridas."}
            </p>
            <Button
              onClick={confirmar}
              className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              {pendencia.reconexao ? "Reconectar esta conta" : "Confirmar conexão"}
            </Button>
            <Button
              variant="outline"
              onClick={trocarConta}
              className="w-full h-12 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Trocar de conta
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/onboarding-motorista" })}
              className="w-full h-11 font-bold uppercase text-[10px] tracking-widest rounded-xl"
            >
              Voltar sem conectar
            </Button>
          </>
        )}

        {(status === "confirmando" || status === "cancelando") && (
          <>
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin mx-auto" />
            <h1 className="text-lg font-bold uppercase italic">
              {status === "confirmando" ? "Confirmando conexão" : "Cancelando autorização"}
            </h1>
            <p className="text-sm text-white/60">
              {status === "confirmando"
                ? "Estamos validando a conta e ativando a conexão somente após sua confirmação."
                : "A conta continuará desconectada enquanto você escolhe outra conta Mercado Pago."}
            </p>
          </>
        )}

        {status === "troca" && (
          <>
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Autorização cancelada</h1>
            <p className="text-sm text-white/60">
              Nenhuma conta foi conectada. Abra o Mercado Pago, saia da conta atual e entre na conta
              que deseja usar. Depois volte à Zuvvi e inicie a conexão novamente.
            </p>
            <Button
              onClick={abrirMercadoPago}
              className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Abrir Mercado Pago para trocar conta
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/onboarding-motorista" })}
              className="w-full h-12 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Voltar e conectar novamente
            </Button>
          </>
        )}

        {status === "conectado" && (
          <>
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Conta conectada</h1>
            <p className="text-sm text-white/60">
              A conta Mercado Pago foi confirmada e está pronta para os recebimentos Pix.
            </p>
            <Button
              onClick={() => navigate({ to: "/onboarding-motorista" })}
              className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Continuar
            </Button>
          </>
        )}

        {status === "erro" && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Falha na conexão</h1>
            <p className="text-sm text-white/60">{erro}</p>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/onboarding-motorista" })}
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
