import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { getCnhCorrectionUploadUrl, submitCnhCorrection } from '@/lib/motorista.functions';
import { toast } from 'sonner';

interface CnhCorrectionFormProps {
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
  onSubmitted: () => Promise<void>;
}

export default function CnhCorrectionForm({
  cnhNumero: initialCnhNumero,
  cnhCategoria: initialCnhCategoria,
  cnhValidade: initialCnhValidade,
  onSubmitted
}: CnhCorrectionFormProps) {
  const [cnhNumero, setCnhNumero] = useState(initialCnhNumero || '');
  const [cnhCategoria, setCnhCategoria] = useState(initialCnhCategoria || '');
  const [cnhValidade, setCnhValidade] = useState(initialCnhValidade || '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getUploadUrlFn = useServerFn(getCnhCorrectionUploadUrl);
  const submitCorrectionFn = useServerFn(submitCnhCorrection);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
        toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB.');
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (cnhNumero.length !== 11) {
      setError('O número da CNH deve ter 11 dígitos.');
      return;
    }
    if (!['A', 'AB'].includes(cnhCategoria.toUpperCase())) {
      setError('Categoria deve ser A ou AB.');
      return;
    }
    if (!cnhValidade) {
      setError('Informe a validade da CNH.');
      return;
    }
    if (!file) {
      setError('A nova foto da CNH é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Obter URL de upload
      const { uploadUrl, storagePath } = await getUploadUrlFn({
        data: {
          mimeType: file.type as any,
          fileSize: file.size
        }
      });


      // 2. Upload real (PUT)
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadRes.ok) {
        throw new Error('Falha no upload da imagem.');
      }

      // 3. Submeter dados
      await submitCorrectionFn({
        data: {
          cnh_numero: cnhNumero,
          cnh_categoria: cnhCategoria.toUpperCase() as any,
          cnh_validade: cnhValidade,
          storagePath
        }
      });


      toast.success('CNH enviada para análise!');
      await onSubmitted();
    } catch (err: any) {
      console.error('Erro na correção da CNH:', err);
      setError(err.message || 'Ocorreu um erro ao enviar a correção.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = cnhNumero.length === 11 && 
                  ['A', 'AB'].includes(cnhCategoria.toUpperCase()) && 
                  cnhValidade !== '' && 
                  file !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest">Número da CNH (11 dígitos)</Label>
          <Input 
            value={cnhNumero}
            onChange={(e) => setCnhNumero(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="Ex: 12345678901"
            className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-zuvvi-volt/50 transition-colors"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest">Categoria</Label>
          <div className="flex gap-2">
            {['A', 'AB'].map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={cnhCategoria.toUpperCase() === cat ? 'default' : 'outline'}
                onClick={() => setCnhCategoria(cat)}
                className={`flex-1 h-12 rounded-xl uppercase font-black tracking-tighter text-lg transition-all ${
                  cnhCategoria.toUpperCase() === cat 
                  ? 'bg-zuvvi-volt text-black border-none shadow-[0_0_20px_rgba(198,255,61,0.2)] scale-[1.02]' 
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
                disabled={isSubmitting}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest">Nova Validade</Label>
          <Input 
            type="date"
            value={cnhValidade}
            onChange={(e) => setCnhValidade(e.target.value)}
            className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-zuvvi-volt/50 transition-colors [color-scheme:dark]"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-white/40 uppercase font-black tracking-widest">Nova Foto da CNH</Label>
          <div 
            onClick={() => !isSubmitting && fileInputRef.current?.click()}
            className={`relative aspect-[16/9] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
              previewUrl ? 'border-zuvvi-volt/50 bg-white/5' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview CNH" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-zuvvi-volt" />
                </div>
              </>
            ) : (
              <div className="text-center space-y-2 p-6">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-6 h-6 text-white/40" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Tocar para selecionar</p>
                <p className="text-[9px] text-white/20 uppercase">JPG, PNG ou WEBP (Max 10MB)</p>
              </div>
            )}
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-xs text-red-200 font-medium leading-relaxed">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        className={`w-full h-14 rounded-2xl uppercase font-black tracking-widest transition-all ${
          isValid && !isSubmitting
          ? 'bg-zuvvi-volt text-black hover:bg-zuvvi-volt/90 shadow-[0_8px_32px_rgba(198,255,61,0.2)] hover:scale-[1.01]' 
          : 'bg-white/5 text-white/20 border border-white/10'
        }`}
      >
        {isSubmitting ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Enviando...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>Enviar CNH Atualizada</span>
          </div>
        )}
      </Button>

      <p className="text-[9px] text-white/20 text-center uppercase tracking-widest leading-relaxed">
        Seus dados serão revisados pela equipe administrativa.<br />
        O status continuará "Em Análise" após o envio.
      </p>
    </form>
  );
}
