import { GoogleGenAI } from '@google/genai';

// Khởi tạo Gemini client từ API key trong .env.local
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

/**
 * Gọi Gemini và trả về toàn bộ response cùng lúc.
 */
export async function askGemini(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  return response.text ?? '';
}

/**
 * Gọi Gemini theo chế độ streaming — callback được gọi từng chunk văn bản.
 * Tạo trải nghiệm "AI đang gõ" như ChatGPT.
 */
export async function streamGemini(
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  for await (const chunk of stream) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
  }
}
