import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Image as ImageIcon, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getPassengerProfilePhoto,
  savePassengerProfilePhoto,
  PASSENGER_PROFILE_PHOTO_QUERY_KEY,
} from "@/lib/passenger-profile-photo.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_SOURCE_FILE_SIZE = 15 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1024;

async function normalizeProfileImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha uma imagem válida.");
  }

  if (file.size > MAX_SOURCE_FILE_SIZE) {
    throw new Error("A imagem é muito grande. Escolha uma foto de até 15 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível abrir esta imagem."));
      img.src = objectUrl;
    });

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Não foi possível preparar a foto.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.88);
    });

    if (!blob) {
      throw new Error("Não foi possível preparar a foto.");
    }

    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function PassengerProfilePhoto() {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const getPhotoFn = useServerFn(getPassengerProfilePhoto);
  const savePhotoFn = useServerFn(savePassengerProfilePhoto);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: PASSENGER_PROFILE_PHOTO_QUERY_KEY,
    queryFn: () => getPhotoFn(),
  });
  const photoUrl = data?.signedUrl ?? null;

  const handleSelectedFile = async (file?: File) => {
    if (!file || isUploading) return;

    setPickerOpen(false);
    setIsUploading(true);

    try {
      const normalized = await normalizeProfileImage(file);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-perfil")
        .upload(path, normalized, {
          contentType: "image/jpeg",
          cacheControl: "0",
          upsert: true,
        });

      if (uploadError) {
        throw new Error("Não foi possível enviar a foto. Tente novamente.");
      }

      await savePhotoFn({ data: { path } });
      await queryClient.invalidateQueries({ queryKey: PASSENGER_PROFILE_PHOTO_QUERY_KEY });
      toast.success("Foto de perfil atualizada.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível atualizar sua foto.");
    } finally {
      setIsUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isUploading}
          aria-label={photoUrl ? "Alterar foto de perfil" : "Adicionar foto de perfil"}
          className="relative w-24 h-24 rounded-full overflow-hidden bg-zuvvi-volt/10 flex items-center justify-center border-2 border-zuvvi-volt/20 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Foto de perfil"
              className="h-full w-full object-cover"
            />
          ) : isLoading ? (
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
          ) : (
            <User className="w-12 h-12 text-zuvvi-volt" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-zuvvi-indigo/75 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-zuvvi-volt animate-spin" />
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isUploading}
          aria-label="Escolher origem da foto"
          className="absolute -right-1 -bottom-1 h-9 w-9 rounded-full bg-zuvvi-volt text-zuvvi-indigo border-4 border-zuvvi-indigo-dark flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-70"
        >
          <Camera className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleSelectedFile(event.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => void handleSelectedFile(event.target.files?.[0])}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-[92vw] w-full sm:max-w-sm rounded-[2rem] border-white/10 bg-zuvvi-indigo-dark p-6">
          <DialogHeader>
            <DialogTitle>Foto de perfil</DialogTitle>
            <DialogDescription>
              Escolha uma foto da galeria ou tire uma nova agora.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                galleryInputRef.current?.click();
              }}
              className="min-h-14 rounded-2xl border border-white/10 bg-white/5 px-4 flex items-center gap-3 text-left transition-colors hover:bg-white/10"
            >
              <span className="h-10 w-10 rounded-xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-zuvvi-volt" />
              </span>
              <span>
                <span className="block font-bold">Escolher da galeria</span>
                <span className="block text-[11px] text-muted-foreground">Usar uma foto que já está no celular</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                cameraInputRef.current?.click();
              }}
              className="min-h-14 rounded-2xl border border-zuvvi-volt/20 bg-zuvvi-volt/10 px-4 flex items-center gap-3 text-left transition-colors hover:bg-zuvvi-volt/15"
            >
              <span className="h-10 w-10 rounded-xl bg-zuvvi-volt text-zuvvi-indigo flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5" />
              </span>
              <span>
                <span className="block font-bold text-zuvvi-volt">Abrir câmera</span>
                <span className="block text-[11px] text-muted-foreground">Tirar uma foto de perfil agora</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
