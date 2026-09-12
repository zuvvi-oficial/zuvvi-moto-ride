import { useServerFn } from "@tanstack/react-start";
import { ProfilePhotoPicker } from "@/components/shared/ProfilePhotoPicker";
import {
  getMotoristaProfilePhoto,
  saveMotoristaProfilePhoto,
  MOTORISTA_PROFILE_PHOTO_QUERY_KEY,
} from "@/lib/motorista-profile-photo.functions";

export function MotoristaProfilePhoto() {
  const getPhotoFn = useServerFn(getMotoristaProfilePhoto);
  const savePhotoFn = useServerFn(saveMotoristaProfilePhoto);

  return (
    <ProfilePhotoPicker
      getPhotoFn={getPhotoFn}
      savePhotoFn={savePhotoFn}
      queryKey={MOTORISTA_PROFILE_PHOTO_QUERY_KEY}
      sizePx={64}
    />
  );
}
