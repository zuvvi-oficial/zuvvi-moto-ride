import { useServerFn } from "@tanstack/react-start";
import { ProfilePhotoPicker } from "@/components/shared/ProfilePhotoPicker";
import {
  getPassengerProfilePhoto,
  savePassengerProfilePhoto,
  PASSENGER_PROFILE_PHOTO_QUERY_KEY,
} from "@/lib/passenger-profile-photo.functions";

export function PassengerProfilePhoto() {
  const getPhotoFn = useServerFn(getPassengerProfilePhoto);
  const savePhotoFn = useServerFn(savePassengerProfilePhoto);

  return (
    <ProfilePhotoPicker
      getPhotoFn={getPhotoFn}
      savePhotoFn={savePhotoFn}
      queryKey={PASSENGER_PROFILE_PHOTO_QUERY_KEY}
      sizePx={96}
    />
  );
}
