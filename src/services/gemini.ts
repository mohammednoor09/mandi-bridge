import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMarketInsight(crop: string, district: string, role: "seller" | "buyer", language: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `As an agricultural market expert in Karnataka, provide a short, professional market insight for ${role === "seller" ? "farmers (sellers)" : "bulk buyers"} regarding ${crop} in ${district} district. 
  The insight should be around 2-3 sentences. 
  Include specific details like price trends, supply/demand factors, or weather impacts relevant to this region.
  Respond in ${language === "kn" ? "Kannada" : language === "hi" ? "Hindi" : "English"}.
  Do not use markdown formatting, just plain text.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "Market data is currently being updated. Please check back shortly.";
  } catch (error) {
    console.error("Error fetching market insight:", error);
    return "Unable to fetch live insights at the moment. Please try again later.";
  }
}

export async function getFullMarketReport(crop: string, district: string, role: "seller" | "buyer", language: string) {
  const model = "gemini-3.1-pro-preview";
  const prompt = `As an agricultural market analyst, provide a detailed market report for ${role === "seller" ? "farmers" : "bulk buyers"} about ${crop} in ${district}, Karnataka.
  Include:
  1. Current Price Analysis
  2. Supply and Demand Forecast
  3. Regional Factors (Weather, Logistics)
  4. Strategic Advice for the next 2 weeks.
  Respond in ${language === "kn" ? "Kannada" : language === "hi" ? "Hindi" : "English"}.
  Use clear headings and bullet points.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "Detailed report is currently unavailable.";
  } catch (error) {
    console.error("Error fetching full report:", error);
    return "Unable to generate full report at this time.";
  }
}
