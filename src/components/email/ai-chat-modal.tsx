'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChatModal({ open, onOpenChange, email }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: { id: string; subject: string | null; body_text: string | null; sender_name: string | null; sent_date: string | null };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-generate initial summary when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      handleSend('이 이메일을 분석하여 요약해주세요.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user' as const, content: messageText }];
    setMessages(newMessages);
    if (!text) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_context: {
            subject: email.subject,
            body: email.body_text,
            sender: email.sender_name,
            date: email.sent_date,
          },
          messages: newMessages,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response || 'Error generating response.' }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'AI 응답 생성에 실패했습니다.' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setMessages([]); }}>
      <DialogContent className="glass border-border max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-primary text-sm tracking-wider">
            AI ANALYSIS — {email.subject || '(No Subject)'}
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3 min-h-[300px] max-h-[50vh]">
          {messages.filter(m => !(m.role === 'user' && m.content === '이 이메일을 분석하여 요약해주세요.' && messages.indexOf(m) === 0)).map((msg, i) => (
            <div key={i} className={`${msg.role === 'user' ? 'ml-8' : 'mr-8'}`}>
              <div className={`rounded-lg p-3 text-xs ${
                msg.role === 'user'
                  ? 'bg-primary/10 border border-primary/20 text-foreground'
                  : 'bg-muted/30 border border-border text-foreground'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="markdown-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 px-1">
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mr-8">
              <div className="rounded-lg p-3 bg-muted/30 border border-border text-xs text-muted-foreground animate-pulse">
                분석 중...
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="추가 질문을 입력하세요..."
            rows={2}
            className="bg-background border-border text-xs resize-none text-foreground flex-1"
          />
          <Button onClick={() => handleSend()} disabled={loading || !input.trim()}
            className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-auto px-4 self-end">
            SEND
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
