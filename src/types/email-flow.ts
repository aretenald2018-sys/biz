export type FlowStepType = 'request' | 'response' | 'follow_up';

export interface EmailFlowStep {
  id: string;
  email_id: string;
  step_type: FlowStepType;
  actor: string | null;
  summary: string;
  is_current: number;
  step_order: number;
  created_at: string;
  updated_at: string;
}
