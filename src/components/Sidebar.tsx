import { motion } from 'motion/react';
import { Settings, Plus, MessageSquare, Menu, X, Trash2, Cpu, User } from 'lucide-react';
import { ChatSession } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  isOpen, 
  setIsOpen 
}: SidebarProps) {
  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />
      
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-white/80 backdrop-blur-xl border-r border-black/5 transition-transform duration-300 ease-in-out",
          "flex flex-col h-full text-slate-700",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 tracking-wide">Nexus AI</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-black/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-4">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-black/5 hover:bg-black/10 border border-black/10 transition-colors text-sm font-medium text-slate-900 group"
          >
            <Plus className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Recent Chats
          </div>
          {sessions.length === 0 && (
            <div className="px-3 py-4 text-sm text-slate-500 italic text-center">
              No recent chats
            </div>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group",
                activeSessionId === session.id
                  ? "bg-indigo-500/10 text-indigo-700 font-medium"
                  : "hover:bg-black/5 text-slate-600 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{session.title}</span>
              </div>
              <div 
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className={cn(
                  "opacity-0 hover:text-red-600 p-1 rounded-md hover:bg-black/10 transition-all",
                  "group-hover:opacity-100"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-black/5">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/5 transition-colors text-sm font-medium">
            <User className="w-4 h-4" />
            My Account
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/5 transition-colors text-sm font-medium">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
