export interface Participant {
  id: string;
  ticket_id: string;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  organization: string | null;
}

export interface CommunicationEdge {
  id: string;
  ticket_id: string;
  from_participant_id: string;
  to_participant_id: string;
  email_id: string;
  direction: string;
}

export interface GraphNode {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  organization: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  count: number;
  reverseCount: number;
  bidirectional: boolean;
}
