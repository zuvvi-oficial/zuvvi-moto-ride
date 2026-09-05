-- G4: getUploadUrl validava mimeType/fileSize no input, mas os dois eram
-- opcionais e nada disso era imposto pelo Storage em si — a URL assinada
-- gerada aceitava qualquer conteúdo/tamanho enviado direto pelo cliente,
-- ignorando o que o app declarou. O enforcement real precisa estar no
-- bucket, não só no validador de entrada da server function.
do $$
begin
  update storage.buckets
     set file_size_limit = 10485760, -- 10 MB, mesmo limite já validado em getUploadUrl/getCnhCorrectionUploadUrl
         allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
   where id = 'documentos-motorista';

  if not found then
    raise notice 'Bucket documentos-motorista não encontrado neste ambiente — nenhum limite aplicado (nada a fazer em ambientes sem o bucket já criado).';
  end if;
end
$$;
