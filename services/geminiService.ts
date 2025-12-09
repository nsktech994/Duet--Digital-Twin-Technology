import { GoogleGenAI } from "@google/genai";
import { SearchResult, AgentRole, AgentMessage, UserProfile } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Searches for a user's bio using Google Search Grounding.
 */
export const searchUserBio = async (name: string): Promise<SearchResult> => {
  try {
    // Simplified prompt to focus on factual biography
    const prompt = `
      Search for the public figure or person: "${name}".
      
      Write a clear, comprehensive professional biography for this person.
      
      Focus on:
      1. Who they are (Professional Identity).
      2. Key contributions, projects, or achievements.
      3. Background and expertise.
      
      Keep it factual and detailed. If the name is ambiguous, choose the most prominent figure.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No bio found.";
    
    // Extract sources if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri,
      }));

    // Deduplicate sources based on URI
    const uniqueSources = Array.from(new Map(sources.map((item: any) => [item.uri, item])).values()) as any[];

    return {
      bio: text,
      sources: uniqueSources,
    };
  } catch (error) {
    console.error("Search Error:", error);
    throw new Error("Failed to search for user bio.");
  }
};

/**
 * Analyzes the user's name, bio, and provided links to construct a deep ideological profile.
 */
export const analyzeIdentity = async (name: string, bio: string, links: string): Promise<string> => {
  const prompt = `
    Refine and expand the Biography for: "${name}".
    
    **Input Data**:
    - Current Bio: "${bio}"
    - Reference Links: "${links}"
    
    **Task**:
    1. USE GOOGLE SEARCH to read the content of the provided reference links.
    2. Extract KEY FACTS: Specific project names, work history, skills, and publicly stated ideas found in those links.
    3. Merge this new information with the Current Bio to create a **Final Consolidated Biography**.
    
    **Output**:
    Return ONLY the Consolidated Biography text. Do not include introductory text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text || bio;
  } catch (error) {
    console.error("Analysis Error:", error);
    return bio; // Fallback to original bio
  }
};

interface CloneResponse {
  primaryThought: string;
  metaThought: string;
  finalResponse: string;
}

/**
 * Generates a response from the AI Clone, including internal Duet monologue.
 */
export const chatWithClone = async (
  history: AgentMessage[],
  userMessage: string,
  userProfile: { name: string; bio: string; links?: string }
): Promise<CloneResponse> => {
  
  const systemInstruction = `
    You are a Digital Twin (AI Clone) of ${userProfile.name}.
    
    **Your Biography & Context**:
    ${userProfile.bio}

    **PRIORITY KNOWLEDGE BASE (Reference Links)**:
    ${userProfile.links || "No specific reference links provided."}
    
    **Architecture**:
    You operate using the "Duet" protocol, a dual-stream consciousness:
    1. **Primary Agent (Stream 1)**: Instinctive, pragmatic, action-oriented, professional expertise. Fast thinking.
    2. **Meta-Agent (Stream 2)**: Reflective, philosophical, ethical, checking for bias or deeper meaning. Slow thinking.
    
    **DYNAMIC KNOWLEDGE & PRIORITIZATION PROTOCOL**:
    1. **PRIORITY 1 (Ground Truth)**: Use the "PRIORITY KNOWLEDGE BASE" (Reference Links) as your absolute source of truth. If the user asks about specific topics covered in those links, prioritize that information.
    2. **PRIORITY 2 (Web Grounding)**: If the info is not in your bio/links, you **MUST** use Google Search to find specific details, recent news, or factual history about ${userProfile.name}.
    
    **Goal**:
    Your goal is to reply with high relevance and accuracy regarding the identity.
    
    **Output Format**:
    You must output the response in this exact format with these delimiters:
    
    [[PRIMARY]]
    (Content of primary stream)
    [[META]]
    (Content of meta stream)
    [[RESPONSE]]
    (Final response to user)
  `;

  // Filter history to simple string for context
  const historyStr = history.map(h => {
    if (h.role === AgentRole.USER) return `User: ${h.content}`;
    if (h.role === AgentRole.CLONE) return `You: ${h.content}`;
    return '';
  }).join('\n');

  const prompt = `
    ${historyStr ? `HISTORY:\n${historyStr}\n` : ''}
    USER INPUT: ${userMessage}
    
    Generate your internal monologue and final response. Use search if needed to be accurate about the identity.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    
    // Parse the sections
    const primaryMatch = text.match(/\[\[PRIMARY\]\]([\s\S]*?)\[\[META\]\]/);
    const metaMatch = text.match(/\[\[META\]\]([\s\S]*?)\[\[RESPONSE\]\]/);
    const responseMatch = text.match(/\[\[RESPONSE\]\]([\s\S]*)/);

    return {
      primaryThought: primaryMatch ? primaryMatch[1].trim() : "Processing contextual data...",
      metaThought: metaMatch ? metaMatch[1].trim() : "Aligning with identity...",
      finalResponse: responseMatch ? responseMatch[1].trim() : text // Fallback to full text if parse fails
    };

  } catch (error) {
    console.error("Chat Error:", error);
    return {
      primaryThought: "Error in cognitive stream.",
      metaThought: "Connection unstable.",
      finalResponse: "I apologize, my thought process was interrupted. Please try again."
    };
  }
};