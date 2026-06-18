import { useState, useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { ChatSession, Message } from './types';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find(s => s.id !== id)?.id || null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && images.length === 0) || isLoading) return;

    let currentSessionId = activeSessionId;
    let newSessions = [...sessions];
    
    // We base the session title on the textual input if it's new
    const fallbackTitle = images.length > 0 ? "Analyzed Images" : "New Conversation";
    const titleFromInput = input.trim() ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : fallbackTitle;

    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: titleFromInput,
        messages: [],
        updatedAt: Date.now(),
      };
      newSessions = [newSession, ...newSessions];
      currentSessionId = newSession.id;
      setActiveSessionId(newSession.id);
    } else {
      // Update title if it's the first message
      const sessionIndex = newSessions.findIndex(s => s.id === currentSessionId);
      if (sessionIndex !== -1 && newSessions[sessionIndex].messages.length === 0) {
        newSessions[sessionIndex] = {
          ...newSessions[sessionIndex],
          title: titleFromInput
        };
      }
    }

    const userMessage: Message = { 
      id: generateId(), 
      role: 'user', 
      content: input,
      images: images.length > 0 ? [...images] : undefined
    };
    
    const assistantMessageId = generateId();
    const initialAssistantMessage: Message = { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true };

    const updateMessages = (sessionId: string, newMsg: Message) => {
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          const exists = s.messages.some(m => m.id === newMsg.id);
          const newMessages = exists 
            ? s.messages.map(m => m.id === newMsg.id ? newMsg : m)
            : [...s.messages, newMsg];
          return { ...s, messages: newMessages, updatedAt: Date.now() };
        }
        return s;
      }));
    };

    setSessions(newSessions); // Apply title updates if any
    updateMessages(currentSessionId, userMessage);
    
    setInput('');
    setImages([]);
    setIsLoading(true);
    
    // Add pending assistant message
    setTimeout(() => {
      updateMessages(currentSessionId!, initialAssistantMessage);
    }, 50);

    try {
      const sessionToUse = newSessions.find(s => s.id === currentSessionId) || newSessions[0];
      const contextMessages = [...sessionToUse.messages, userMessage];

      let apiUrl = import.meta.env.APP_URL || '';
      if (apiUrl === 'MY_APP_URL' || !apiUrl.startsWith('http')) {
        apiUrl = ''; // Use relative path if APP_URL is not a valid absolute URL
      }
      
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let assistantContent = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  assistantContent += parsed.text;
                  updateMessages(currentSessionId!, {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: assistantContent,
                    isStreaming: true
                  });
                } else if (parsed.error) {
                  console.error("API returned error:", parsed.error);
                }
              } catch (e) {
                // Ignore parse errors from partial chunks
              }
            }
          }
        }
      }

      // Final update to remove streaming state
      updateMessages(currentSessionId!, {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        isStreaming: false
      });

    } catch (error) {
      console.error('Chat error:', error);
      updateMessages(currentSessionId!, {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        isStreaming: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setIsSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col h-full relative border-l border-black/5">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-black/5 bg-slate-50/80 backdrop-blur-md absolute top-0 left-0 right-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-black/5 text-slate-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-semibold font-display tracking-wide">Nexus AI</div>
          <div className="w-8" /> {/* Spacer */}
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pt-16 lg:pt-0">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 mb-6 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                <span className="text-3xl">✨</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-3 text-center">
                How can I help you today?
              </h1>
              <p className="text-slate-500 text-center max-w-md">
                I'm your advanced AI assistant. Ask me anything, assign me tasks, or let's create something new together.
              </p>
            </div>
          ) : (
            <div className="pb-32">
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-10">
          <ChatInput 
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            images={images}
            setImages={setImages}
          />
        </div>
      </main>
    </div>
  );
}

