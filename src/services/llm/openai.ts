import OpenAI from 'openai';

// Khởi tạo OpenAI client từ API key trong .env.local
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  // dangerouslyAllowBrowser: true vì đây là môi trường dev/demo
  // Production nên dùng backend proxy để bảo vệ API key
  dangerouslyAllowBrowser: true,
});

/**
 * Gọi OpenAI và trả về toàn bộ response cùng lúc.
 */
export async function askOpenAI(
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content ?? '';
}

/**
 * Gọi OpenAI theo chế độ streaming — callback được gọi từng chunk.
 * Tạo trải nghiệm "AI đang gõ" như ChatGPT.
 */
export async function streamOpenAI(
  prompt: string,
  onChunk: (text: string) => void,
  model: string = 'gpt-4o'
): Promise<void> {
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      onChunk(delta);
    }
  }
}
