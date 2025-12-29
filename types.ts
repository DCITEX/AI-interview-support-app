
export type SpeakerRole = 'Staff' | 'Client' | '記録中...' | string;

export interface TranscriptItem {
  id: string;
  speaker: SpeakerRole;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface SummaryTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface RagDocument {
  id: string;
  name: string;
  content: string;
  type: 'text/plain' | 'application/json' | 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
}

export enum AppStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR',
}
