import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { api, User, Knowledge } from "./api";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please click the 'API Key' button in the header to provide your own key.");
  }
  return new GoogleGenAI({ apiKey });
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error:", error);
  let message = error.message || "An unexpected error occurred with the AI service.";
  
  // Detect quota/rate limit errors
  if (message.toLowerCase().includes("quota") || message.toLowerCase().includes("exhausted") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
    message = "Gemini API quota exceeded. This usually happens with the shared free key. Please click the 'API Key' button in the header to use your own Google Cloud API key for uninterrupted access.";
  }
  
  throw new Error(message);
};

export const agents = {
  /**
   * Profile Analysis Agent
   * Analyzes onboarding data to generate a structured skill profile.
   */
  analyzeProfile: async (userData: Partial<User>) => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this user profile and generate a structured skill profile:
        Domain: ${userData.domain}
        Sub-domain: ${userData.subdomain}
        Current Designation: ${userData.current_designation}
        Desired Designation: ${userData.desired_designation}
        Experience: ${userData.experience} years
        Goal: ${userData.learning_goal}
        Style: ${userData.learning_style}
        Persona: ${userData.persona}
        
        Return a JSON object with:
        - primary_skills: string[]
        - suggested_focus_areas: string[]
        - initial_level_assessment: string (Beginner, Intermediate, Expert)
        - reasoning: string`,
        config: {
          responseMimeType: "application/json",
          systemInstruction: `You are an AI assistant adopting the persona of a ${userData.persona}. Your goal is to analyze the user's profile and provide a structured skill assessment. Maintain the chosen persona throughout your reasoning.`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primary_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggested_focus_areas: { type: Type.ARRAY, items: { type: Type.STRING } },
              initial_level_assessment: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text);
    } catch (error) {
      return handleGeminiError(error);
    }
  },

  /**
   * Quiz Generation Agent (with RAG)
   * Generates a quiz based on domain, level, and weak areas.
   */
  generateQuiz: async (user: User, weakTopics: string[] = [], knowledge: Knowledge[] = [], incorrectQuestions: any[] = []) => {
    const currentLevel = user.current_levels?.[user.domain]?.[user.subdomain] || "Beginner";
    const currentDifficulty = user.current_difficulty?.[user.domain]?.[user.subdomain] || 5;

    const knowledgeContext = knowledge.length > 0 
      ? `Context Knowledge from Knowledge Base:\n${knowledge.map(k => k.content).join("\n\n")}`
      : "No specific knowledge base context provided. Use general expertise.";
      
    const weakContext = weakTopics.length > 0 
      ? `STRICT REQUIREMENT: The user has failed or is weak in these topics: ${weakTopics.join(", ")}. 
         You MUST generate questions specifically targeting these weak areas to ensure they achieve perfection in them. 
         Focus 100% of the quiz on these topics if possible, otherwise 80%.` 
      : `The user has performed exceptionally well in previous assessments. 
         STRICT REQUIREMENT: Provide a challenging, advanced assessment of the subdomain. 
         Focus on complex integrations, architectural trade-offs, and deep optimization techniques relevant to ${user.subdomain}.`;

    const incorrectContext = incorrectQuestions.length > 0
      ? `REPHRASE REQUIREMENT: The user got these specific questions WRONG in their last attempt:
         ${incorrectQuestions.map((q, i) => `${i+1}. ${q.question_text} (Correct Answer was: ${q.correct_answer})`).join("\n")}
         
         You MUST include these topics in the new quiz, but REPHRASE the questions. Do not use the exact same wording, but test the same underlying concept. 
         The user must see these concepts again until they get them right.`
      : "";

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are an expert Adaptive Learning Agent. Generate a high-quality, personalized quiz for this user:
        
        USER PROFILE:
        - Domain: ${user.domain}
        - Sub-domain: ${user.subdomain}
        - Current Designation: ${user.current_designation}
        - Desired Designation: ${user.desired_designation}
        - Current Level: ${currentLevel}
        - Current Difficulty Score: ${currentDifficulty}/10
        - Learning Goal: ${user.learning_goal}
        - Persona: ${user.persona}
        
        ${weakContext}
        
        ${incorrectContext}
        
        ${knowledgeContext}
        
        REQUIREMENTS:
        1. Generate exactly 10 multiple-choice questions.
        2. Each question must have exactly 4 options.
        3. One option must be the correct_answer.
        4. Provide a DETAILED, educational explanation. 
           - Explain WHY the correct answer is right.
           - Explain WHY the other options are wrong or less optimal.
        5. Assign a specific topic to each question.
        6. The difficulty should be calibrated to the user's Current Level (${currentLevel}) AND their Current Difficulty Score (${currentDifficulty}/10). 
           - Difficulty 1-3: Fundamental concepts, direct questions.
           - Difficulty 4-7: Application of concepts, scenario-based questions.
           - Difficulty 8-10: Complex problem solving, edge cases, and deep architectural understanding.
        7. If Knowledge Base context is provided, you MUST reference it in the "references" field (e.g., ["Knowledge Base: Section on X", "Official Documentation"]).
        
        Return ONLY a valid JSON object.`,
        config: {
          responseMimeType: "application/json",
          systemInstruction: `You are an expert Adaptive Learning Agent adopting the persona of a ${user.persona}. Your goal is to generate a high-quality, personalized quiz. Provide thorough explanations for every question, covering both correct and incorrect options. If you use the provided knowledge context, cite it explicitly.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              quiz_title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question_text: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correct_answer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    references: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["question_text", "options", "correct_answer", "explanation", "topic"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("The AI returned an empty response.");
      
      try {
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return parsed;
      } catch (parseError) {
        console.error("JSON Parse Error:", text);
        throw new Error("AI generated an invalid response format.");
      }
    } catch (error: any) {
      return handleGeminiError(error);
    }
  },

  /**
   * Evaluation Agent
   * Evaluates quiz responses and provides feedback based on history.
   */
  evaluatePerformance: async (user: User, quiz: any, answers: string[], history: any[] = []) => {
    try {
      const historyContext = history.length > 0 
        ? `User History (Last ${history.length} attempts): ${JSON.stringify(history.map(h => ({ score: h.score, weak: h.weak_topics })))}`
        : "No previous history.";

      const currentDifficulty = user.current_difficulty?.[user.domain]?.[user.subdomain] || 5;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Evaluate these quiz responses and the user's overall mastery:
        Quiz: ${JSON.stringify(quiz)}
        User Answers: ${JSON.stringify(answers)}
        Current Difficulty: ${currentDifficulty}/10
        ${historyContext}
        
        CRITICAL LEVELING & DIFFICULTY LOGIC:
        - Level: Holistic performance (Beginner, Intermediate, Expert).
        - Difficulty Score (1-10): Granular adjustment within or across levels.
        - If score > 80% on current difficulty: Increase difficulty by 1 (max 10).
        - If score < 40% on current difficulty: Decrease difficulty by 1 (min 1).
        - LEVEL TRANSITION: If score is 100% AND current difficulty is 10, promote the user to the next Level (Beginner -> Intermediate -> Expert).
        - DIFFICULTY RESET: When a user is promoted to a new Level, reset their difficulty score to 3 for that new level to allow them to build a solid foundation at the higher tier.
        - Expert Level: Requires 80%+ score on Difficulty 10 AND no remaining weak topics.
        - Exceptional Performance: If score is 100% but difficulty is < 10, increase difficulty by 2 instead of 1.
        
        Return a JSON object with:
        - score_percentage: number (for this quiz)
        - weak_topics: string[] (topics they got wrong in THIS quiz)
        - recommended_level: string (Beginner, Intermediate, Expert)
        - recommended_difficulty: number (1-10)
        - feedback: string (Explain why they are at this level/difficulty and what they need to master next)`,
        config: {
          responseMimeType: "application/json",
          systemInstruction: `You are an expert Adaptive Learning Agent adopting the persona of a ${user.persona}. Your goal is to evaluate quiz responses and provide feedback. Maintain the chosen persona throughout your feedback.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score_percentage: { type: Type.NUMBER },
              weak_topics: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommended_level: { type: Type.STRING },
              recommended_difficulty: { type: Type.NUMBER },
              feedback: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text);
    } catch (error) {
      return handleGeminiError(error);
    }
  }
};
