import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: number;
  topic: string;
  explanation: string;
}

export async function generateAdaptiveQuestions(
  userLevel: number,
  incorrectTopics: string[],
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Generate ${count} Ruby language quiz questions for a user at proficiency level ${userLevel}/5. 
  Focus on these topics where the user struggled: ${incorrectTopics.join(", ") || "General Ruby"}.
  Make sure the questions are challenging but appropriate for level ${userLevel}.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.INTEGER, description: "0-indexed correct option" },
            difficulty: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["text", "options", "correctAnswer", "difficulty", "topic", "explanation"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
