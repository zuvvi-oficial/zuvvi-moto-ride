import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
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

type CallbackStatus = "processando" | "pendente" | "confirmando" | "conectado" | "erro";

function MercadoPagoCallback() {
  const navigate = useNavigate();
  const concluirFn = useServerFn(concluirConexaoMercadoPagoPixSegura);
  const getPendingFn = useServerFn(getAutorizacaoPendenteMercadoPagoPixSegura);
  const confirmarFn = useServerFn(confirmarConexaoMercadoPagoPixSegura);
  const [status, setStatus] = useState<CallbackStatus>("processando");
  const [erro, setErro] = useState(
    "Não foi possível validar a autorização com o Mercado Pago. Tente novamente.",
  );

  useEffect(() => {
    let ativo = true;

    const recuperarPendencia = async () => {
      try {
        const pendencia = await getPendingFn();
        if (!ativo) return;
        setStatus(pendencia.pendente ? "pendente" : "erro");
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
        setStatus(resultado.pending === true ? "pendente" : "erro");
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
      } else {
        setErro("Não há uma autorização pendente para confirmar. Inicie a conexão novamente.");
      }
      setStatus("erro");
    } catch {
      setStatus("erro");
    }
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

        {status === "pendente" && (
          <>
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h1 className="text-lg font-bold uppercase italic">Autorização recebida</h1>
            <p className="text-sm text-white/60">
              O Mercado Pago autorizou o acesso, mas sua conta ainda não está conectada. Confirme
              abaixo para ativar os recebimentos Pix nesta conta.
            </p>
            <Button
              onClick={confirmar}
              className="w-full h-12 bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Confirmar conexão
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/onboarding-motorista" })}
              className="w-full h-12 font-black uppercase text-[11px] tracking-widest rounded-xl"
            >
              Voltar sem conectar
            </Button>
          </>
        )}

        {status === "confirmando" && (
          <>
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin mx-auto" />
            <h1 className="text-lg font-bold uppercase italic">Confirmando conexão</h1>
            <p className="text-sm text-white/60">
              Estamos ativando com segurança a conta que você acabou de confirmar.
            </p>
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
