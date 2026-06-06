import { GoogleGenAI, Type } from "@google/genai";

// Helper to get the API key with priority: localStorage > globalState > process.env
let globalApiKey: string | null = null;
let isKeyActiveForEveryone: boolean = false;

export const setGlobalApiKey = (key: string | null, activeForEveryone: boolean = false) => {
  globalApiKey = key;
  isKeyActiveForEveryone = activeForEveryone;
};

export const getApiKeySource = (isAdmin: boolean = false) => {
  if (typeof window === 'undefined') return "default";
  const localKey = localStorage.getItem('GEMINI_CUSTOM_API_KEY');
  
  // Local key always takes priority if present
  if (localKey) return "local";

  // If global key exists
  if (globalApiKey) {
    if (isAdmin || isKeyActiveForEveryone) return "database";
    // If not admin and not active for everyone, it falls back to default
  }
  
  return "default";
};

export const clearLocalApiKey = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('GEMINI_CUSTOM_API_KEY');
  }
};


const getApiKey = () => {
  const isAdmin = typeof window !== 'undefined' && 
                 (window as any).__IS_ADMIN_USER__ === true;
                 
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_CUSTOM_API_KEY') : null;
  
  if (localKey) return localKey;
  
  if (globalApiKey && (isAdmin || isKeyActiveForEveryone)) {
    return globalApiKey;
  }

  try {
    // Safely retrieve the Vite-defined process.env variable
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env.GEMINI_API_KEY || '';
    }
  } catch (e) {}

  return '';
};

// Lazy initialization of AI instance
let aiInstance: GoogleGenAI | null = null;
let currentActiveKey: string | null = null;

const getAI = () => {
  const apiKey = getApiKey();
  if (!aiInstance || currentActiveKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentActiveKey = apiKey;
  }
  return aiInstance;
};

export const testGeminiConnection = async () => {
  try {
    const ai = getAI();
    // Simplified content format for basic generation
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say 'Ready'"
    });
    return !!response.text;
  } catch (error: any) {
    console.error("Gemini Test Error:", error);
    // Rethrow a cleaner error message if possible
    throw new Error(error.message || "Failed to connect to Google Gemini API");
  }
};

export const getMathTutorResponse = async (userPrompt: string, history: any[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history,
      { role: "user", parts: [{ text: userPrompt }] }
    ],
    config: {
      systemInstruction: "You are an expert Math Tutor on a platform called MathLMS Pro. Help the student understand mathematical concepts clearly. Use LaTeX for formulas if needed."
    }
  });

  return response.text || "عذراً، لم أستطع توليد رد في هذه اللحظة.";
};


