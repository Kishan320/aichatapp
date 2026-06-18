import { motion } from 'motion/react';
import { User, Cpu, Copy, Check, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import { Message } from '../types';
import { cn } from '../lib/utils';

export function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline) {
    return (
      <div className="relative group/code">
        <button
          onClick={handleCopy}
          className="absolute -right-2 -top-2 p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-all opacity-0 group-hover/code:opacity-100 border border-black/5 shadow-sm"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    );
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-4 w-full px-4 lg:px-8 py-6 group",
        isUser ? "bg-transparent" : "bg-black/[0.02]"
      )}
    >
      <div className="flex-1 max-w-4xl mx-auto flex gap-4 lg:gap-6">
        <div className="shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center border border-black/10">
              <User className="w-4 h-4 text-slate-700" />
            </div>
          ) : (
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              {message.isStreaming && (
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="space-y-3">
            <div className="font-medium text-sm text-slate-500 font-display flex items-center gap-2">
              {isUser ? 'You' : 'Nexus AI'}
            </div>
            
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {message.images.map((img, idx) => (
                  <div key={idx} className="relative w-48 h-48 rounded-xl overflow-hidden border border-black/5 shadow-md">
                    <img src={img} alt={`Attached preview ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {message.isStreaming && !message.content ? (
              <div className="h-6 flex items-center ml-2">
                <div className="dot-flashing"></div>
              </div>
            ) : (
              <div className="markdown-body pr-4 overflow-hidden break-words">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{ code: CodeBlock }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {!isUser && !message.isStreaming && message.content && (
            <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-black/5 rounded-md transition-colors"
                title="Copy response"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
