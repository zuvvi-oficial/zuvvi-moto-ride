import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUploadUrl, registrarDocumento, salvarDadosCNH, criarVeiculo, enviarParaAnalise } from "@/lib/motorista.functions";
import { toast } from "sonner";
import { Upload, CheckCircle2, Clock, X, FileText, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function OnboardingForm({ user, onSubmitted }: { user: any, onSubmitted: () => void }) {
  const [cnhData, setCnhData] = useState({ numero: "", categoria: "A", validade: "" });
  const [veiculoData, setVeiculoData] = useState({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
  const [pix, setPix] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});

  const getUploadUrlFn = useServerFn(getUploadUrl);
  const registrarDocFn = useServerFn(registrarDocumento);
  const salvarCNHFn = useServerFn(salvarDadosCNH);
  const criarVeiculoFn = useServerFn(criarVeiculo);
  const enviarAnaliseFn = useServerFn(enviarParaAnalise);

  const handleFileUpload = async (tipo: string, file: File) => {
    setUploading(tipo);
    try {
      const { uploadUrl, storagePath } = await getUploadUrlFn({ data: { tipo } });
      const resp = await fetch(uploadUrl, { method: 'PUT', body: file });
      if (!resp.ok) throw new Error("Falha no upload para o storage");
      
      await registrarDocFn({ data: { tipo, storagePath } });
      setStatus(prev => ({ ...prev, [tipo]: true }));
      toast.success(\`\${tipo} enviado com sucesso!\`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    try {
      await salvarCNHFn({ data: { cnh_numero: cnhData.numero, cnh_categoria: cnhData.categoria, cnh_validade: cnhData.validade, chave_pix: pix } });
      await criarVeiculoFn({ data: { ...veiculoData, ano: parseInt(veiculoData.ano) } });
      await enviarAnaliseFn();
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 font-poppins text-white">
      <h2 className="text-xl font-bold">Documentação do Motorista</h2>
      
      {/* CNH Section */}
      <div className="bg-white/5 p-4 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-zuvvi-volt"/> CNH</h3>
        <input placeholder="Número da CNH" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setCnhData({...cnhData, numero: e.target.value})} />
        <div className="flex gap-2">
          {['A', 'AB'].map(cat => (
            <button key={cat} onClick={() => setCnhData({...cnhData, categoria: cat})} className={`px-4 py-2 rounded-lg text-xs font-bold ${cnhData.categoria === cat ? 'bg-zuvvi-volt text-zuvvi-indigo' : 'bg-white/10'}`}>{cat}</button>
          ))}
        </div>
        <input type="date" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setCnhData({...cnhData, validade: e.target.value})} />
        <input type="file" onChange={e => e.target.files?.[0] && handleFileUpload('cnh', e.target.files[0])} />
      </div>

      {/* Veículo Section */}
      <div className="bg-white/5 p-4 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Bike className="w-4 h-4 text-zuvvi-volt"/> Veículo</h3>
        <input placeholder="Placa" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setVeiculoData({...veiculoData, placa: e.target.value})} />
        <input placeholder="Marca" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setVeiculoData({...veiculoData, marca: e.target.value})} />
        <input placeholder="Modelo" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setVeiculoData({...veiculoData, modelo: e.target.value})} />
        <input placeholder="Ano" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setVeiculoData({...veiculoData, ano: e.target.value})} />
        <input placeholder="Cor" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setVeiculoData({...veiculoData, cor: e.target.value})} />
        <input type="file" onChange={e => e.target.files?.[0] && handleFileUpload('crlv', e.target.files[0])} />
      </div>

      {/* PIX */}
      <div className="bg-white/5 p-4 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-zuvvi-volt"/> Recebimento</h3>
        <input placeholder="Chave Pix" className="w-full bg-white/10 p-3 rounded-lg text-sm" onChange={e => setPix(e.target.value)} />
      </div>

      <button onClick={handleSubmit} className="w-full bg-zuvvi-volt text-zuvvi-indigo font-black uppercase py-4 rounded-2xl">Enviar para Análise</button>
    </div>
  );
}
