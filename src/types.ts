export interface VoiceOption {
  name: string;
  value: string;
  gender: 'male' | 'female';
  desc: string;
}

export interface PanelData {
  id: number;
  startY: number;
  imageSrc: string;
  script: string;
  voice: string;
  audioUrl: string | null;
  isGeneratingScript: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}
