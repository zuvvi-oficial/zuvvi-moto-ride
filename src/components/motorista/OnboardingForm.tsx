import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUploadUrl, registrarDocumento, salvarDadosCNH, criarVeiculo, enviarParaAnalise } from "@/lib/motorista.functions";
import { toast } from "sonner";
import { Bike, Loader2, CheckCircle2, FileText, CreditCard, Upload, AlertCircle, FileText as DocIcon } from "lucide-react";

type UploadState = {
  status: 'idle' | 'uploading' | 'success' | 'error';
  fileName?: string;
  previewUrl?: string;
  errorMessage?: string;
};

export default function OnboardingForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [cnhData, setCnhData] = useState({ numero: "", categoria: "A", validade: "" });
  const [veiculoData, setVeiculoData] = useState({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
  const [pix, setPix] = useState("");
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getUploadUrlFn = useServerFn(getUploadUrl);
  const registrarDocFn = useServerFn(registrarDocumento);
  const salvarCNHFn = useServerFn(salvarDadosCNH);
  const criarVeiculoFn = useServerFn(criarVeiculo);
  const enviarAnaliseFn = useServerFn(enviarParaAnalise);

  const handleFileUpload = async (tipo: string, file: File) => {
    // 1. Iniciar estado visual "uploading" e gerar preview local
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    
    setUploads(prev => ({
      ...prev,
      [tipo]: { status: 'uploading', fileName: file.name, previewUrl }
    }));

    try {
      // 2. Obter URL assinada
      const { uploadUrl, storagePath } = await getUploadUrlFn({ data: { tipo } });
      
      // 3. Upload real para o bucket
      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!resp.ok) throw new Error("Falha ao enviar arquivo para o servidor.");

      // 4. Registrar o documento na tabela
      await registrarDocFn({ data: { tipo, storagePath } });
      
      // 5. Sucesso - Atualizar estado visual
      setUploads(prev => ({
        ...prev,
        [tipo]: { 
          ...prev[tipo], 
          status: 'success' 
        }
      }));
      toast.success(`${file.name} enviado com sucesso!`);
    } catch (e: any) {
      console.error("Erro no upload do motorista:", e);
      setUploads(prev => ({
        ...prev,
        [tipo]: { 
          status: 'error', 
          fileName: file.name,
          errorMessage: e.message || "Erro ao enviar arquivo" 
        }
      }));
      toast.error(e.message || "Erro no upload");
    }
  };

  const renderUpload = (tipo: string, label: string) => {
    const state = uploads[tipo] || { status: 'idle' };
    const isUploading = state.status === 'uploading';
    const isSuccess = state.status === 'success';
    const isError = state.status === 'error';

    return (
      <div className="space-y-2">
        <div className={`relative flex items-center justify-between p-4 bg-white/5 rounded-2xl border transition-all ${
          isSuccess ? 'border-zuvvi-volt bg-zuvvi-volt/5' : 
          isError ? 'border-red-500/50 bg-red-500/5' : 
          'border-white/10 hover:border-white/20'
        }`}>
          <div className="flex items-center gap-3">
            {/* Preview ou Ícone */}
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {isSuccess && state.previewUrl ? (
                <img src={state.previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : isSuccess && !state.previewUrl ? (
                <DocIcon className="w-5 h-5 text-zuvvi-volt" />
              ) : isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-zuvvi-volt" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Upload className="w-5 h-5 text-white/20" />
              )}
            </div>

            <div className="flex flex-col">
              <span className={`text-xs font-bold uppercase tracking-tight ${isSuccess ? 'text-zuvvi-volt' : 'text-white/70'}`}>
                {label}
              </span>
              {state.fileName && (
                <span className="text-[10px] text-white/40 truncate max-w-[150px]">
                  {state.fileName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuccess ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-[10px] font-black text-zuvvi-volt uppercase">
                  <span>Enviado</span>
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <label className="cursor-pointer text-[9px] text-white/30 hover:text-white/60 underline mt-1">
                  Alterar
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    onChange={e => e.target.files?.[0] && handleFileUpload(tipo, e.target.files[0])} 
                  />
                </label>
              </div>
            ) : (
              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                isUploading ? 'opacity-50 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'
              }`}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" />
                    <span>Selecionar</span>
                  </>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  disabled={isUploading}
                  onChange={e => e.target.files?.[0] && handleFileUpload(tipo, e.target.files[0])} 
                />
              </label>
            )}
          </div>
        </div>
        
        {isError && (
          <p className="text-[10px] text-red-500 ml-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {state.errorMessage || "Falha ao enviar, tente novamente"}
          </p>
        )}
      </div>
    );
  };

  const canSubmit = 
    cnhData.numero && cnhData.validade && pix &&
    veiculoData.placa && veiculoData.marca && veiculoData.modelo && veiculoData.ano && veiculoData.cor &&
    ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'].every(t => uploads[t]?.status === 'success');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await salvarCNHFn({ data: { 
        cnh_numero: cnhData.numero, 
        cnh_categoria: cnhData.categoria, 
        cnh_validade: cnhData.validade, 
        chave_pix: pix 
      } });
      
      await criarVeiculoFn({ data: { 
        ...veiculoData, 
        ano: parseInt(veiculoData.ano) 
      } });
      
      await enviarAnaliseFn();
      toast.success("Cadastro enviado para análise!");
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar cadastro");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="space-y-4">
        <h3 className="text-xs font-black text-zuvvi-volt uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-4 h-4" /> 1. Documentos Pessoais
        </h3>
        <div className="space-y-2">
          {renderUpload('identidade', 'RG ou CPF')}
          {renderUpload('comprovante_residencia', 'Comprovante de Residência')}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-black text-zuvvi-volt uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-4 h-4" /> 2. CNH
        </h3>
        <div className="space-y-3">
          <input 
            placeholder="Número da CNH" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
            value={cnhData.numero}
            onChange={e => setCnhData({...cnhData, numero: e.target.value})}
          />
          <div className="flex gap-2">
            {['A', 'AB'].map(cat => (
              <button 
                key={cat}
                type="button"
                onClick={() => setCnhData({...cnhData, categoria: cat})}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${cnhData.categoria === cat ? 'bg-zuvvi-volt text-zuvvi-indigo' : 'bg-white/5 text-white/40 border border-white/10'}`}
              >
                CATEGORIA {cat}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Validade da CNH</label>
            <input 
              type="date"
              className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
              value={cnhData.validade}
              onChange={e => setCnhData({...cnhData, validade: e.target.value})}
            />
          </div>
          {renderUpload('cnh', 'Foto da CNH')}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-black text-zuvvi-volt uppercase tracking-widest flex items-center gap-2">
          <Bike className="w-4 h-4" /> 3. Veículo
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <input 
            placeholder="Placa" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
            value={veiculoData.placa}
            onChange={e => setVeiculoData({...veiculoData, placa: e.target.value.toUpperCase()})}
          />
          <input 
            placeholder="Ano" 
            type="number"
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
            value={veiculoData.ano}
            onChange={e => setVeiculoData({...veiculoData, ano: e.target.value})}
          />
        </div>
        <input 
          placeholder="Marca (ex: Honda)" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.marca}
          onChange={e => setVeiculoData({...veiculoData, marca: e.target.value})}
        />
        <input 
          placeholder="Modelo (ex: CG 160)" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.modelo}
          onChange={e => setVeiculoData({...veiculoData, modelo: e.target.value})}
        />
        <input 
          placeholder="Cor" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.cor}
          onChange={e => setVeiculoData({...veiculoData, cor: e.target.value})}
        />
        <div className="space-y-2">
          {renderUpload('crlv', 'Foto do CRLV Digital')}
          {renderUpload('foto_veiculo', 'Foto do Veículo')}
          {renderUpload('foto_placa', 'Foto da Placa')}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-black text-zuvvi-volt uppercase tracking-widest flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> 4. Recebimento
        </h3>
        <input 
          placeholder="Chave Pix" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={pix}
          onChange={e => setPix(e.target.value)}
        />
      </section>

      <button 
        disabled={!canSubmit || isSubmitting}
        onClick={handleSubmit}
        className="w-full bg-zuvvi-volt disabled:bg-white/5 disabled:text-white/20 text-zuvvi-indigo py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs zuvvi-glow transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        ENVIAR PARA ANÁLISE
      </button>
    </div>
  );
}
