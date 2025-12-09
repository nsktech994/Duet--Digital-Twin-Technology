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

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string; // The main display content (User msg or Clone final answer)
  timestamp: number;
  internalThoughts?: InternalThought[]; // For CLONE messages, contains the Duet process
  isTyping?: boolean; // UI state
}

export interface UserProfile {
  name: string;
  bio: string;
  links?: string; // Reference URLs for knowledge base
  source: 'manual' | 'search';
  topic?: string; // Optional context for the session
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SearchResult {
  bio: string;
  sources: GroundingSource[];
}