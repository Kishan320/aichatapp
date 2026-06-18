import { ArrowUp, Paperclip, Mic, X, ImageIcon } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  images: string[];
  setImages: (images: string[]) => void;
}

export function ChatInput({ input, setInput, onSubmit, isLoading, images, setImages }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }
      setIsRecording(true);
    }
  };

  useEffect(() => {
    let recognition: any = null;
    
    if (isRecording) {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      const startInput = input;
      
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(startInput + (startInput && !startInput.endsWith(' ') ? ' ' : '') + transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
        setIsRecording(false);
      }
    }
    
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    
    // Convert selected files to object URLs or base64
    // We need base64 for API transmission to Gemini
    const newImages: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }
    
    if (newImages.length > 0) {
      setImages([...images, ...newImages]);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto max-w-4xl w-full px-4 lg:px-8 pb-4 relative z-10">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          "relative bg-white/80 backdrop-blur-2xl border rounded-2xl shadow-2xl p-2 transition-all focus-within:ring-1 focus-within:ring-indigo-500/20",
          isDragging ? "border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/50" : "border-black/10 focus-within:border-indigo-500/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-2 p-2 overflow-x-auto custom-scrollbar pt-1"
            >
              {images.map((img, idx) => (
                <div key={idx} className="relative shrink-0 group">
                  <div className="w-16 h-16 rounded-xl border border-black/10 overflow-hidden bg-slate-100">
                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-slate-200 text-slate-900 rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-slate-300 transition-all border border-black/20"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex items-end gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-500 hover:text-slate-900 hover:bg-black/5 rounded-xl transition-colors shrink-0"
            title="Attach image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDragging ? "Drop images here..." : "Message..."}
            className="flex-1 max-h-[200px] bg-transparent border-0 resize-none outline-none py-3 px-2 text-slate-900 placeholder:text-slate-400 custom-scrollbar"
            rows={1}
            disabled={isLoading}
          />

          <div className="flex items-center gap-1 shrink-0 pb-1">
            <button 
              type="button" 
              onClick={toggleRecording}
              className={cn(
                "p-2 rounded-xl transition-all",
                isRecording 
                  ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 animate-pulse" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-black/5"
              )}
              title={isRecording ? "Stop recording" : "Use microphone"}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSubmit()}
              disabled={(!input.trim() && images.length === 0) || isLoading}
              className={cn(
                "p-2 rounded-xl flex items-center justify-center transition-all disabled:opacity-50",
                input.trim() || images.length > 0
                  ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20" 
                  : "bg-slate-200 text-slate-400"
              )}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
      
      <div className="text-center text-[10px] sm:text-xs text-slate-500/85 font-medium mt-3 px-4">
        Nexus AI can make mistakes. Consider verifying important information.
      </div>
    </div>
  );
}
