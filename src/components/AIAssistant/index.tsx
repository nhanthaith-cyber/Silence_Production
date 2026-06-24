import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useLLM } from '../../hooks/useLLM';
import { buildProductionPrompt } from '../../services/llm/prompts';
import { Send, Trash2, Bot, User, Loader, Sparkles } from 'lucide-react';

const QUICK_QUESTIONS = [
  'Sản phẩm nào đang lãi nhất?',
  'Tồn kho sản phẩm nào sắp hết?',
  'Lô sản xuất nào đang chậm nhất?',
  'Tổng lợi nhuận ròng hiện tại là bao nhiêu?',
];

export const AIAssistant: React.FC = () => {
  const { products, productionBatches, sales, expenses } = useApp();
  const { messages, isLoading, error, sendMessage, clearMessages } = useLLM();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const question = text ?? input.trim();
    if (!question || isLoading) return;

    // Tạo prompt đầy đủ có context dữ liệu, hiển thị câu hỏi ngắn gọn cho user
    const fullPrompt = buildProductionPrompt(
      products, productionBatches, sales, expenses, question
    );
    setInput('');
    await sendMessage(fullPrompt, question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="page-container fade-in" style={styles.wrapper}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.headerTop}>
            <div style={styles.aiAvatar}>
              <Sparkles size={18} style={{ color: '#6cf8bb' }} />
            </div>
            <div>
              <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Trợ lý AI sản xuất
              </h2>
              <p style={{ color: '#8191a9', fontSize: '13px', margin: '2px 0 0 0' }}>
                Phân tích dữ liệu xưởng theo thời gian thực • Powered by GPT-4o
              </p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearMessages} style={styles.clearBtn} title="Xóa cuộc trò chuyện">
            <Trash2 size={14} />
            <span>Xóa hội thoại</span>
          </button>
        )}
      </div>

      {/* Chat area */}
      <div style={styles.chatCard}>
        <div style={styles.messageList}>
          {/* Welcome state */}
          {messages.length === 0 && (
            <div style={styles.welcomeState}>
              <div style={styles.welcomeIcon}>
                <Bot size={32} style={{ color: '#006c49' }} />
              </div>
              <h3 style={styles.welcomeTitle}>Xin chào! Tôi là AI trợ lý của xưởng</h3>
              <p style={styles.welcomeDesc}>
                Tôi đã được nạp toàn bộ dữ liệu sản xuất, tồn kho và tài chính của bạn.
                Hỏi tôi bất cứ điều gì về hoạt động kinh doanh.
              </p>

              {/* Quick questions */}
              <div style={styles.quickQuestions}>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    style={styles.quickBtn}
                    disabled={isLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.messageRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {/* Avatar assistant */}
              {msg.role === 'assistant' && (
                <div style={styles.avatarSmall}>
                  <Bot size={14} style={{ color: '#006c49' }} />
                </div>
              )}

              <div
                style={{
                  ...styles.bubble,
                  ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant),
                }}
              >
                {msg.content || (isLoading && i === messages.length - 1 ? (
                  <span style={styles.typingDots}>
                    <span>●</span><span>●</span><span>●</span>
                  </span>
                ) : '')}
              </div>

              {/* Avatar user */}
              {msg.role === 'user' && (
                <div style={{ ...styles.avatarSmall, backgroundColor: '#091426' }}>
                  <User size={14} style={{ color: '#fff' }} />
                </div>
              )}
            </div>
          ))}

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={styles.inputArea}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI về dữ liệu sản xuất... (Enter để gửi)"
            style={styles.input}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: isLoading || !input.trim() ? 0.5 : 1,
            }}
          >
            {isLoading ? <Loader size={18} style={styles.spinIcon} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ai-typing span {
          display: inline-block;
          animation: typing 1.2s infinite;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: 'calc(100vh - 64px - 48px)',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  aiAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#091426',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: 'transparent',
    border: '1px solid #e0e3e5',
    borderRadius: '6px',
    color: '#8191a9',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  chatCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e3e5',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  welcomeState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
    padding: '40px 20px',
    gap: '12px',
  },
  welcomeIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: '#f0faf5',
    border: '1px solid #6cf8bb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  welcomeTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#091426',
    margin: 0,
  },
  welcomeDesc: {
    fontSize: '14px',
    color: '#8191a9',
    maxWidth: '480px',
    lineHeight: 1.6,
    margin: 0,
  },
  quickQuestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '8px',
    maxWidth: '600px',
  },
  quickBtn: {
    padding: '8px 14px',
    backgroundColor: '#f2f4f6',
    border: '1px solid #e0e3e5',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#091426',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontWeight: 500,
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
  },
  avatarSmall: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: '#f0faf5',
    border: '1px solid #c8f5e2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '72%',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleUser: {
    backgroundColor: '#091426',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  bubbleAssistant: {
    backgroundColor: '#f8fafc',
    color: '#191c1e',
    border: '1px solid #eceef0',
    borderBottomLeftRadius: '4px',
  },
  typingDots: {
    display: 'inline-flex',
    gap: '4px',
    color: '#8191a9',
  },
  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#ffdad6',
    color: '#ba1a1a',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
  },
  inputArea: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #eceef0',
    backgroundColor: '#fafbfc',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '1.5px solid #e0e3e5',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#191c1e',
    backgroundColor: '#fff',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    backgroundColor: '#006c49',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  spinIcon: {
    animation: 'spin 1s linear infinite',
  },
};
