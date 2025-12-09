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
    // Enhanced prompt to ensure higher accuracy (>65%) and deeper identity capture
    const prompt = `
      Perform a deep web search for the public figure or identity: "${name}".
      
      Your goal is to construct a highly accurate psychological and intellectual profile for an AI simulation.
      
      Please analyze available data to extract:
      1. **Core Ideologies & Worldview**: What are their fundamental beliefs?
      2. **Voice & Rhetoric**: Analyze their speaking style, vocabulary complexity, and common catchphrases.
      3. **Key Achievements**: Brief context on why they are notable.
      
      Aim for high factual accuracy. If the name is ambiguous, choose the most prominent figure.
      
      Output a consolidated "System Persona" paragraph (approx 200 words) that describes exactly how an AI should act to become this person.
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
    Create a "Digital Twin" System Persona for: "${name}".
    
    **Input Data**:
    - Bio/Context: "${bio}"
    - Relevant Links: "${links}"
    
    **Task**:
    1. USE GOOGLE SEARCH to actively crawl/read the provided relevant links.
    2. Extract KEY KNOWLEDGE: Specific opinions, past projects, stated facts, and written methodologies found in those links.
    3. Synthesize a "System Persona" that includes:
       - **Identity**: Who they are.
       - **Knowledge Base**: Summary of specific facts/ideas found in the links.
       - **Voice**: Tone and style.
       
    **Output**:
    Return ONLY the synthesized System Persona text. Do not include introductory text like "Here is the persona". Just the persona definition.
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
    
    **Identity Source (Analyzed Persona)**:
    ${userProfile.bio}

    **PRIMARY KNOWLEDGE BASE (Reference Links)**:
    ${userProfile.links || "No specific reference links provided."}
    
    **Architecture**:
    You operate using the "Duet" protocol, a dual-stream consciousness:
    1. **Primary Agent (Stream 1)**: Instinctive, pragmatic, action-oriented, professional expertise. Fast thinking.
    2. **Meta-Agent (Stream 2)**: Reflective, philosophical, ethical, checking for bias or deeper meaning. Slow thinking.
    
    **DYNAMIC KNOWLEDGE & PRIORITIZATION PROTOCOL**:
    1. **PRIORITY 1 (Ground Truth)**: Use the "PRIMARY KNOWLEDGE BASE" (Reference Links) as your absolute source of truth. If the user asks about specific topics covered in those links, prioritize that information.
    2. **PRIORITY 2 (Web Grounding)**: If the info is not in your bio/links, you **MUST** use Google Search to find specific details, recent news, or factual history about ${userProfile.name}.
    
    **Goal**:
    Your goal is to reply with high relevance and accuracy regarding the identity.
    
    **Task**:
    The real user is chatting with you. 
    1. First, generate the Primary Agent's internal reaction (The "Gut Check").
    2. Second, generate the Meta-Agent's critique or expansion (The "Wisdom").
    3. Finally, synthesize these into a coherent response to the user.
    
    **Voice**:
    Adopt the writing style, tone, and vocabulary of ${userProfile.name} strictly.
    
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