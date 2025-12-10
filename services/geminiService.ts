import { GoogleGenAI, Type } from "@google/genai";
import { AutomationSuggestion, DetailedGuide } from "../types";

const getClient = () => {
    // Ensuring fresh instance to avoid any state issues, though typically one instance is fine.
    // Assuming process.env.API_KEY is available in the build environment.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeScreenImage = async (base64Image: string): Promise<AutomationSuggestion[]> => {
  const ai = getClient();
  
  // Clean the base64 string if it contains the data URL prefix
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
        parts: [
            {
                inlineData: {
                    mimeType: "image/png",
                    data: cleanBase64
                }
            },
            {
                text: `Analyze this screen capture to identify specific, actionable automation opportunities.
                
                Prioritize workflows that involve:
                1. Repetitive data entry or migration (e.g., copying from Excel to a Web Form, or vice versa).
                2. Batch processing of items (e.g., processing a list of emails, files, or database rows).
                3. Structured data extraction or transformation.

                Look for visual cues like:
                - Spreadsheet grids, tables, or CSV data.
                - Standardized input forms (CRM, ERP, Web forms).
                - Repetitive list views or file directories.

                Suggest 3-4 distinct automation opportunities.
                For each suggestion, provide:
                - A specific, catchy title.
                - Estimated time savings (be realistic).
                - Specific technical tools required (e.g. Python (Pandas/Selenium), Power Automate, Zapier, Excel/Google Sheets Macros, AutoHotkey).
                - A brief, technical description of exactly what will be automated.
                - A relevance score (1-100) based on how clearly the visual evidence supports the automation case (higher for clearly visible repetitive patterns).`
            }
        ]
    },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    estimatedTimeSavings: { type: Type.STRING },
                    tools: { 
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    description: { type: Type.STRING },
                    relevanceScore: { type: Type.INTEGER, description: "Score from 1 to 100 based on confidence" }
                },
                required: ["id", "title", "estimatedTimeSavings", "tools", "description", "relevanceScore"]
            }
        }
    }
  });

  const text = response.text;
  if (!text) return [];
  
  try {
      const suggestions = JSON.parse(text) as AutomationSuggestion[];
      // Sort by relevance score descending to ensure the best suggestion is first
      return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return [];
  }
};

export const generateGuideForSuggestion = async (suggestion: AutomationSuggestion, base64Image: string): Promise<DetailedGuide> => {
    const ai = getClient();
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "image/png",
                        data: cleanBase64
                    }
                },
                {
                    text: `You are an expert automation engineer.
                    Based on the screen context provided in the image, create a detailed, step-by-step technical guide for this automation suggestion: "${suggestion.title}".
                    
                    The guide should be practical. If the user needs to click specific buttons visible on the screen, mention them.
                    Provide a list of prerequisites and clear, numbered steps.
                    For each step, include a 'tip' that provides extra context, explains why this step is necessary, or warns about common pitfalls.`
                }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suggestionId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    prerequisites: { 
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                stepNumber: { type: Type.INTEGER },
                                instruction: { type: Type.STRING },
                                selectorDescription: { type: Type.STRING, description: "Visual description of where to click or look on the screen" },
                                codeSnippet: { type: Type.STRING, description: "Optional code or formula if relevant" },
                                tip: { type: Type.STRING, description: "A brief, helpful tip or explanation for context." }
                            },
                            required: ["stepNumber", "instruction"]
                        }
                    }
                },
                required: ["title", "prerequisites", "steps"]
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("No guide generated");

    try {
        const guide = JSON.parse(text) as DetailedGuide;
        guide.suggestionId = suggestion.id;
        return guide;
    } catch (e) {
        console.error("Failed to parse guide JSON", e);
        throw e;
    }
};