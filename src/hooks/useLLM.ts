import { useState, useCallback } from 'react';
import { streamOpenAI } from '../services/llm/openai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useLLM = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (prompt: string, displayText?: string) => {
    setIsLoading(true);
    setError(null);

    // Hiển thị câu hỏi của user (displayText ngắn hơn prompt đầy đủ)
    const userContent = displayText ?? prompt;
    setMessages(prev => [...prev, { role: 'user', content: userContent }]);

    // Placeholder trống cho assistant — sẽ fill dần qua streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamOpenAI(prompt, (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
          return updated;
        });
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(`Không thể kết nối Gemini: ${errMsg}`);
      // Xóa placeholder rỗng nếu lỗi
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
};
