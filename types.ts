
export enum AgentRole {
  PRIMARY = 'PRIMARY', // Executive, Action-Oriented (Internal Thought)
  META = 'META',       // Reflective, Philosophical (Internal Thought)
  CLONE = 'CLONE',     // The synthesized persona (Final Response)
  USER = 'USER'        // The actual user
}

export interface InternalThought {
  role: AgentRole;
  content: string;
}

export interface Attachment {
  mimeType: string;
  data: string; // base64
  name?: string;
}

export type ContextNodeType = 'link' | 'file' | 'text';

export interface ContextNode {
  id: string;
  type: ContextNodeType;
  title: string;
  content: string; // URL for links, base64 for files, raw text for text
  mimeType?: string;
  timestamp: number;
  status?: 'idle' | 'fetching' | 'ready' | 'error';
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string; // The main display content (User msg or Clone final answer)
  timestamp: number;
  internalThoughts?: InternalThought[]; // For CLONE messages, contains the Duet process
  attachments?: Attachment[];
  isTyping?: boolean; // UI state
}

export interface UserProfile {
  name: string;
  bio: string;
  links?: string; // Reference URLs for knowledge base
  source: 'manual' | 'search';
  topic?: string; // Optional context for the session
  avatarUrl?: string; // URL of the generated virtual face
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SearchResult {
  bio: string;
  sources: GroundingSource[];
}
