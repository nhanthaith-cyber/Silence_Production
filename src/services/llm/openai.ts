import OpenAI from 'openai';

// Lazy initialization: client chỉ được tạo khi thực sự gọi API
// Tránh crash toàn bộ app khi không có API key (ví dụ: GitHub Pages)
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Chưa cấu hình API key cho AI. Tính năng AI chưa khả dụng trong phiên bản demo này.'
      );
    }
    _client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  return _client;
}

/**
 * Gọi OpenAI và trả về toàn bộ response cùng lúc.
 */
export async function askOpenAI(
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const response = await getClient().chat.completions.create({
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
  const stream = await getClient().chat.completions.create({
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
