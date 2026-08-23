import { create } from 'zustand';

interface SoundState {
  audioElement: HTMLAudioElement | null;
  isUnlocked: boolean;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  unlock: () => void;
  play: (src: string) => Promise<void>;
}

export const useSoundStore = create<SoundState>((set: any, get: any) => ({
  audioElement: null,
  isUnlocked: false,
  setAudioElement: (el: HTMLAudioElement | null) => set({ audioElement: el }),
  unlock: () => {
    const { audioElement, isUnlocked } = get();
    if (!audioElement || isUnlocked) return;
    
    // Silent play to unlock
    audioElement.play()
      .then(() => {
        audioElement.pause();
        audioElement.currentTime = 0;
        set({ isUnlocked: true });
        console.log('[SoundStore] Audio unlocked successfully');
      })
      .catch((err: any) => {
        console.error('[SoundStore] Audio unlock failed', err);
      });
  },
  play: async (src: string) => {
    const { audioElement } = get();
    if (!audioElement) {
      console.error('[SoundStore] No audio element found');
      return;
    }

    try {
      // Resolve path
      const finalSrc = src.startsWith('/') ? src : `/${src}`;
      
      // If src changes, we update it
      if (!audioElement.src.includes(finalSrc)) {
        audioElement.src = finalSrc;
        audioElement.load();
      }
      
      audioElement.currentTime = 0;
      await audioElement.play();
    } catch (err: any) {
      console.error('[SoundStore] Play failed:', err);
      throw err;
    }
  }
}));
