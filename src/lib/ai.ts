import { GoogleGenAI, Type } from "@google/genai";
import { Scenario, Evaluation, Scores } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateScenarios(): Promise<Scenario[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 15 realistic customer enquiry email scenarios for a Singapore Civil Service Customer Service Officer. Each scenario MUST have a unique 'id' (string), 'title', 'description', 'difficulty' (1-4), 'category', 'content' (the detailed email body from the citizen), and 'policyContext' (the internal rules the CSO must follow). Focus on topics like HDB housing grants, CPF withdrawals, NEA environmental complaints, MOM employment disputes, and WOG (Whole-of-Government) issues. Ensure the 'content' and 'policyContext' are substantial (at least 300 words each) to provide a good training experience. Return ONLY a JSON array. Do not include any other text.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              difficulty: { type: Type.INTEGER },
              category: { type: Type.STRING },
              content: { type: Type.STRING },
              policyContext: { type: Type.STRING }
            },
            required: ["id", "title", "description", "difficulty", "category", "content", "policyContext"]
          }
        }
      }
    });

    let text = response.text || "[]";
    console.log("Raw AI Response:", text);

    // Strip markdown if present
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0];
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0];
    }
    
    let data;
    try {
      data = JSON.parse(text.trim());
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      // Try to find array in text
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        data = JSON.parse(text.substring(start, end + 1));
      } else {
        throw e;
      }
    }
    
    if (!Array.isArray(data)) return [];

    return data.map((s: any, index: number) => {
      const content = (s.content || "").trim();
      const policyContext = (s.policyContext || "").trim();
      
      const finalContent = content.length > 20 ? content : `Dear CSC,\n\nI am writing to enquire about ${s.title || 'this matter'}. I have been facing some issues recently and would appreciate your guidance on the next steps.\n\nThank you.\n\nRegards,\nConcerned Citizen`;
      const finalPolicy = policyContext.length > 20 ? policyContext : "Standard Operating Procedure: Please respond with empathy, maintain professional integrity, and provide clear guidance based on existing Whole-of-Government guidelines.";

      return {
        ...s,
        id: s.id || `scenario-${Date.now()}-${index}`,
        title: s.title || "Untitled Scenario",
        description: s.description || "No description provided.",
        difficulty: Number(s.difficulty) || 1,
        category: s.category || "General",
        content: finalContent,
        policyContext: finalPolicy
      };
    });
  } catch (error) {
    console.error("Error generating scenarios:", error);
    return [];
  }
}

export async function evaluateResponse(scenario: Scenario, responseText: string): Promise<{ evaluation: Evaluation, scores: Scores }> {
  const prompt = `
    Scenario Title: ${scenario.title}
    Customer Email: ${scenario.content}
    Internal Policy Context: ${scenario.policyContext}
    
    CSO Response: ${responseText}
    
    Evaluate the CSO response based on these 5 core competencies (0-100 score for each):
    1. Policy Translation (Clarity & Conciseness)
    2. Service with Heart (Empathy & EQ)
    3. Whole-of-Government (WOG) Perspective
    4. Professional Integrity & Tone Management
    5. Problem Ownership
    
    Provide detailed feedback, strengths, improvements, and a score for each competency.
    The tone should be constructive and aligned with Civil Service College Singapore standards.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluation: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
              competencyAnalysis: {
                type: Type.OBJECT,
                properties: {
                  policyTranslation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } } },
                  empathy: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } } },
                  wogPerspective: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } } },
                  integrity: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } } },
                  problemOwnership: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } } }
                }
              }
            }
          },
          scores: {
            type: Type.OBJECT,
            properties: {
              policyTranslation: { type: Type.NUMBER },
              empathy: { type: Type.NUMBER },
              wogPerspective: { type: Type.NUMBER },
              integrity: { type: Type.NUMBER },
              problemOwnership: { type: Type.NUMBER },
              overall: { type: Type.NUMBER }
            }
          }
        }
      }
    }
  });

  return JSON.parse(result.text || "{}");
}
