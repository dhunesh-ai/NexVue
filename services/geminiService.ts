import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, SafetyLevel } from "../types";

// Initialize the client.
// Note: In a real production app, you might proxy this or use a different auth flow.
// For this prototype, we assume the environment variable is injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    signs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Type of sign (e.g., Speed Limit, Stop, Yield)" },
          meaning: { type: Type.STRING, description: "What the sign indicates" },
          location: { type: Type.STRING, description: "Relative location in the image (e.g., Top Right, Center)" }
        },
        required: ["type", "meaning", "location"]
      },
      description: "List of identified road signs."
    },
    hazards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Type of hazard (e.g., Pothole, Pedestrian, Animal, Debris)" },
          severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"], description: "Severity of the hazard" },
          description: { type: Type.STRING, description: "Details about the hazard" }
        },
        required: ["type", "severity", "description"]
      },
      description: "List of detected hazards including potholes and obstacles."
    },
    safetyLevel: {
      type: Type.STRING,
      enum: ["SAFE", "CAUTION", "DANGER"],
      description: "Overall safety assessment of the scene."
    },
    recommendation: {
      type: Type.STRING,
      description: "Driving recommendation for the driver or autonomous system."
    }
  },
  required: ["signs", "hazards", "safetyLevel", "recommendation"]
};

export const analyzeRoadScene = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    const modelId = "gemini-2.5-flash"; // Fast and capable vision model
    
    // Remove the data URL prefix if present to get raw base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG for simplicity, works with PNG too usually
              data: cleanBase64
            }
          },
          {
            text: "Analyze this road scene for an autonomous driving system. Identify road signs, detect potholes or road damage, and spot obstacles. Provide a safety assessment and driving recommendation."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "You are an advanced autonomous vehicle vision system. Your priority is safety. Be precise about road signs and extremely vigilant about hazards like potholes and obstacles.",
        temperature: 0.2 // Low temperature for more deterministic/analytical results
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    const data = JSON.parse(text) as AnalysisResult;
    return {
      ...data,
      timestamp: new Date().toLocaleTimeString()
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};