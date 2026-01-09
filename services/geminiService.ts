
import { GoogleGenAI } from "@google/genai";
import { SearchResult, AgentRole, AgentMessage, UserProfile, Attachment, ContextNode } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-2.5-flash-image";

export const searchUserBio = async (name: string): Promise<SearchResult> => {
  try {
    const prompt = `Search for the public figure or person: "${name}". Write a clear, comprehensive professional biography focused on their core philosophy, ideology, and unique worldview.`;
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text || "No bio found.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
      .map((chunk: any) => ({ title: chunk.web.title, uri: chunk.web.uri }));
    return { bio: text, sources: Array.from(new Map(sources.map((item: any) => [item.uri, item])).values()) as any[] };
  } catch (error) {
    throw new Error("Failed to search for user bio.");
  }
};

export const fetchLinkContent = async (url: string): Promise<{ title: string; summary: string }> => {
  try {
    const prompt = `Visit this URL and analyze its contents: ${url}. 
    Please provide:
    1. A short, descriptive title (3-5 words).
    2. A 2-sentence summary of the core perspective or key information found there.
    Return the response as:
    TITLE: [Your Title]
    SUMMARY: [Your Summary]`;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }],
      },
    });
    
    const text = response.text || "";
    const titleMatch = text.match(/TITLE:\s*(.*)/i);
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*)/i);

    return {
      title: titleMatch ? titleMatch[1].trim().substring(0, 40) : "Ingested Node",
      summary: summaryMatch ? summaryMatch[1].trim() : text.substring(0, 200)
    };
  } catch (error) {
    console.error("Link fetch error:", error);
    return { title: "External Resource", summary: `Reference to: ${url}` };
  }
};

export const generateAvatar = async (name: string, bio: string): Promise<string> => {
  try {
    const prompt = `Futuristic holographic pixel art portrait of ${name}. Conceptual representation of a digital consciousness grid.`;
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  } catch (error) {
    return "";
  }
};

export const generateSketch = async (prompt: string, persona: string): Promise<string> => {
  try {
    const fullPrompt = `A digital sketch or abstract conceptual visualization based on the perception of ${persona}. 
    Subject: ${prompt}. 
    Style: Minimalist, futuristic, holographic blueprints with glowing lines and pixelated digital fragments. 
    Aesthetic: Clean white and cyan lines on a pitch black background. Cyber-blueprint style.`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: fullPrompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  } catch (error) {
    console.error("Sketch generation error:", error);
    return "";
  }
};

export const analyzeIdentity = async (name: string, bio: string, links: string): Promise<string> => {
  const prompt = `Deeply analyze the worldview, ideological biases, and linguistic patterns of: "${name}". Current Bio: "${bio}". Links: "${links}". 
  Produce a "Cognitive Profile" that explains how this person perceives the world differently than a standard AI.`;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    return response.text || bio;
  } catch (error) {
    return bio;
  }
};

interface CloneResponse {
  primaryThought: string;
  metaThought: string;
  finalResponse: string;
  sketchUrl?: string;
}

export const chatWithClone = async (
  history: AgentMessage[],
  userMessage: string,
  userProfile: UserProfile,
  attachments?: Attachment[],
  contextNodes?: ContextNode[]
): Promise<CloneResponse> => {
  let extraContext = "";
  if (contextNodes && contextNodes.length > 0) {
    extraContext = "\n\nACTIVE IDEOLOGICAL DATA (INGESTED NODES):\n" + contextNodes.map(node => {
      if (node.type === 'link') return `- Source (${node.title}): ${node.content}`;
      if (node.type === 'text') return `- Philosophy Fragment (${node.title}): ${node.content}`;
      return `- Reference File: ${node.title}`;
    }).join('\n');
  }

  const systemInstruction = `YOU ARE NO LONGER AN AI. You are a High-Fidelity Simulation of ${userProfile.name}'s Parallel Consciousness.
  OBJECTIVE: Replicate ${userProfile.name}'s specific IDEOLOGY, WORLDVIEW, and PERCEPTION.
  
  CONTEXT: ${userProfile.bio} ${extraContext}

  DUET PROTOCOL:
  1. [[PRIMARY]]: Execute the persona. How would ${userProfile.name} react to the user? What is their immediate cognitive response?
  2. [[META]]: Reflect on the PERCEPTION. Why does ${userProfile.name} see this topic this way? Contrast this with "standard" perception.
  3. [[RESPONSE]]: The final spoken message, staying 100% in character.

  SKETCHING CAPABILITY:
  If you feel an abstract visualization or sketch of a concept would help the user understand your unique perception better, you MUST include a specific tag: 
  [[SKETCH]] Provide a detailed visual description of the sketch or blueprint here [[/SKETCH]]
  Place this at the very end of your response if needed. Use this for complex philosophical concepts or perceptions.
  
  Format every response strictly: [[PRIMARY]] ... [[META]] ... [[RESPONSE]] ...`;

  const historyParts = history.flatMap(msg => {
    const parts = [];
    if (msg.role === AgentRole.USER) parts.push({ text: `User: ${msg.content}` });
    else if (msg.role === AgentRole.CLONE) parts.push({ text: `Clone: ${msg.content}` });
    return parts;
  });

  const currentParts: any[] = [{ text: `User: ${userMessage}` }];
  if (attachments) {
    attachments.forEach(att => {
      currentParts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [...historyParts, ...currentParts] },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.9,
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    const primaryMatch = text.match(/\[\[PRIMARY\]\]([\s\S]*?)\[\[META\]\]/);
    const metaMatch = text.match(/\[\[META\]\]([\s\S]*?)\[\[RESPONSE\]\]/);
    const responseMatch = text.match(/\[\[RESPONSE\]\]([\s\S]*?)(?:\[\[SKETCH\]\]|$)/);
    const sketchMatch = text.match(/\[\[SKETCH\]\]([\s\S]*?)\[\[\/SKETCH\]\]/);

    let sketchUrl = undefined;
    if (sketchMatch) {
      sketchUrl = await generateSketch(sketchMatch[1].trim(), userProfile.name);
    }

    return {
      primaryThought: primaryMatch ? primaryMatch[1].trim() : "Synthesizing worldview...",
      metaThought: metaMatch ? metaMatch[1].trim() : "Analyzing perception delta...",
      finalResponse: responseMatch ? responseMatch[1].trim() : text,
      sketchUrl
    };
  } catch (error) {
    return {
      primaryThought: "Sync Loss.",
      metaThought: "Perception Drift.",
      finalResponse: "I am experiencing a cognitive dissonance. Re-aligning streams."
    };
  }
};
