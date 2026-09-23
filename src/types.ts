export interface VoiceOption {
  name: string;
  value: string;
  gender: 'male' | 'female';
  desc?: string;
}

export interface PanelData {
  id: number;
  startY: number;
  imageSrc: string;
  script: string;
  voice: string;
  audioUrl: string | null;
  mp3Blob?: Blob | null;
  pcmData?: Int16Array | null;
  isGeneratingScript: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}

export interface TtsPart {
  id: string;
  partNumber: number;
  text: string;
  charCount: number;
  isGenerating: boolean;
  pcmData: Int16Array | null;
  sampleRate: number;
  mp3Url: string | null;
  mp3Blob: Blob | null;
  error: string | null;
}

export interface MangaPanelItem {
  id: string;
  src: string;
  file?: File;
  dataUrl?: string;
}
