export type GenerationType = 'weekly_report' | 'dooray';

export interface GenerationTemplate {
  id: string;
  type: GenerationType;
  name: string;
  content: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface GenerationBestPractice {
  id: string;
  type: GenerationType;
  title: string;
  content: string;
  created_at: string;
}

