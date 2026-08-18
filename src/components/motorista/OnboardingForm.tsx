import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUploadUrl, registrarDocumento, salvarDadosCNH, criarVeiculo, enviarParaAnalise } from "@/lib/motorista.functions";
import { toast } from "sonner";
import { Bike, Loader2, CheckCircle2, FileText, CreditCard, Upload, AlertCircle, FileText as DocIcon } from "lucide-react";

type UploadState = {
  status: 'idle' | 'uploading' | 'success' | 'error';
  fileName?: string;
  previewUrl?: string | undefined;
  errorMessage?: string | undefined;
};

export default function OnboardingForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [cnhData, setCnhData] = useState({ numero: "", categoria: "A", validade: "" });
  const [veiculoData, setVeiculoData] = useState({ placa: "", marca: "", modelo: "", ano: "", cor: "" });
  const [veiculoStatus, setVeiculoStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [pix, setPix] = useState("");
  const [pixType, setPixType] = useState<'cpf' | 'telefone' | 'email' | 'aleatoria' | null>(null);
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
      [tipo]: { status: 'uploading', fileName: file.name, previewUrl } as UploadState
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
        } as UploadState
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

  const handleSaveVeiculo = async (data: typeof veiculoData) => {
    if (!data.placa || !data.marca || !data.modelo || !data.ano || !data.cor) return;
    
    setVeiculoStatus('saving');
    try {
      await criarVeiculoFn({ data: { 
        ...data, 
        ano: parseInt(data.ano) 
      } });
      setVeiculoStatus('success');
      toast.success("Veículo salvo com sucesso!");
    } catch (e: any) {
      console.error("Erro ao salvar veículo:", e);
      setVeiculoStatus('error');
      toast.error(e.message || "Erro ao salvar veículo");
    }
  };

  const canSubmit = 
    cnhData.numero.length === 11 && cnhData.validade && pix && pixType &&
    veiculoStatus === 'success' &&
    ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'].every(t => uploads[t]?.status === 'success');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await salvarCNHFn({ data: { 
        cnh_numero: cnhData.numero, 
        cnh_categoria: cnhData.categoria, 
        cnh_validade: cnhData.validade, 
        chave_pix: pix,
        tipo_chave_pix: pixType || undefined
      } });
      
      // O veículo já é salvo via auto-save, mas garantimos aqui se necessário
      if (veiculoStatus !== 'success') {
        await criarVeiculoFn({ data: { 
          ...veiculoData, 
          ano: parseInt(veiculoData.ano) 
        } });
      }
      
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
            placeholder="Número da CNH (11 dígitos)" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
            value={cnhData.numero}
            maxLength={11}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, "");
              if (val.length <= 11) {
                setCnhData({...cnhData, numero: val});
              }
            }}
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
            placeholder="Placa (ABC-1234)" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all font-mono"
            value={veiculoData.placa}
            maxLength={8}
            onChange={e => {
              let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (val.length > 3) {
                val = val.slice(0, 3) + "-" + val.slice(3, 7);
              }
              setVeiculoData({...veiculoData, placa: val});
            }}
            onBlur={() => handleSaveVeiculo(veiculoData)}
          />
          <input 
            placeholder="Ano" 
            type="number"
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
            value={veiculoData.ano}
            onChange={e => setVeiculoData({...veiculoData, ano: e.target.value})}
            onBlur={() => handleSaveVeiculo(veiculoData)}
          />
        </div>
        <input 
          placeholder="Marca (ex: Honda)" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.marca}
          onChange={e => setVeiculoData({...veiculoData, marca: e.target.value.toUpperCase()})}
          onBlur={() => handleSaveVeiculo(veiculoData)}
        />
        <input 
          placeholder="Modelo (ex: CG 160)" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.modelo}
          onChange={e => setVeiculoData({...veiculoData, modelo: e.target.value.toUpperCase()})}
          onBlur={() => handleSaveVeiculo(veiculoData)}
        />
        <input 
          placeholder="Cor" 
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all"
          value={veiculoData.cor}
          onChange={e => setVeiculoData({...veiculoData, cor: e.target.value.toUpperCase()})}
          onBlur={() => handleSaveVeiculo(veiculoData)}
        />

        <div className="flex items-center gap-2 ml-1 min-h-[16px]">
          {veiculoStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Salvando dados do veículo...</span>
            </div>
          )}
          {veiculoStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-[10px] text-zuvvi-volt font-bold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Dados do veículo salvos ✓</span>
            </div>
          )}
          {veiculoStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold">
              <AlertCircle className="w-3 h-3" />
              <span>Erro ao salvar veículo. Tente novamente.</span>
            </div>
          )}
        </div>
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
        <div className="flex gap-2 mb-3">
          {(['cpf', 'telefone', 'email', 'aleatoria'] as const).map(type => (
            <button 
              key={type}
              type="button"
              onClick={() => {
                setPixType(type);
                setPix(""); // Limpa ao trocar tipo
              }}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all uppercase ${pixType === type ? 'bg-zuvvi-volt text-zuvvi-indigo' : 'bg-white/5 text-white/40 border border-white/10'}`}
            >
              {type === 'aleatoria' ? 'Aleatória' : type}
            </button>
          ))}
        </div>
        <input 
          placeholder={!pixType ? "Selecione o tipo de chave" : "Digite a chave Pix"} 
          disabled={!pixType}
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-zuvvi-volt outline-none transition-all disabled:opacity-50"
          value={pix}
          onChange={e => {
            let val = e.target.value;
            if (pixType === 'cpf') {
              val = val.replace(/\D/g, "").slice(0, 11);
              if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
              else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
              else if (val.length > 3) val = val.replace(/(\d{3})(\d{0,3})/, "$1.$2");
            } else if (pixType === 'telefone') {
              val = val.replace(/\D/g, "").slice(0, 11);
              if (val.length > 10) val = val.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
              else if (val.length > 6) val = val.replace(/(\d{2})(\d{4,5})(\d{0,4})/, "($1) $2-$3");
              else if (val.length > 2) val = val.replace(/(\d{2})(\d{0,5})/, "($1) $2");
            }
            setPix(val);
          }}
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
