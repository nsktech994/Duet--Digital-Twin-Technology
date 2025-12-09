import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, AgentRole, UserProfile } from '../types';
import { chatWithClone } from '../services/geminiService';
import { TypewriterText } from './TypewriterText';

interface SimulationProps {
  userProfile: UserProfile;
  onBack: () => void;
}

export const Simulation: React.FC<SimulationProps> = ({ userProfile, onBack }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMsg: AgentMessage = {
      id: Date.now().toString(),
      role: AgentRole.USER,
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await chatWithClone(messages, input, userProfile);
      
      const cloneMsg: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: AgentRole.CLONE,
        content: response.finalResponse,
        timestamp: Date.now(),
        internalThoughts: [
            { role: AgentRole.PRIMARY, content: response.primaryThought },
            { role: AgentRole.META, content: response.metaThought }
        ]
      };

      setMessages(prev => [...prev, cloneMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full max-w-5xl mx-auto">
      
      {/* Header Status */}
      <div className="flex justify-between items-center mb-4 px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
             <div className="relative">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <div className="absolute top-0 left-0 h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
             </div>
             <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">Connected to:</span>
             <span className="text-cyan-400 font-bold text-sm tracking-wide">{userProfile.name}</span>
        </div>
        
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all text-gray-500 hover:text-red-400"
          title="Disconnect from Twin"
        >
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:tracking-widest transition-all hidden sm:inline">End Session</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
        </button>
      </div>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-8 p-4 md:p-8 glass-panel rounded-2xl border border-gray-800 relative scroll-smooth mb-4"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
             <div className="p-6 rounded-full bg-white/5 mb-6">
                <svg className="w-12 h-12 text-cyan-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
             </div>
             <p className="text-lg font-light mb-2">Duet Protocol Initialized</p>
             <p className="text-sm opacity-50 max-w-sm text-center">
                Speak to your clone. It will use a dual-stream cognitive process (Primary & Meta) to form its responses.
             </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === AgentRole.USER ? 'items-end' : 'items-start'}`}>
            
            {/* Message Bubble */}
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm
                ${msg.role === AgentRole.USER 
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-gray-100 rounded-br-none' 
                    : 'bg-gradient-to-br from-cyan-950/30 to-purple-950/30 border border-cyan-900/50 text-gray-100 rounded-bl-none'
                }`}
            >
                {/* Clone Name Header */}
                {msg.role === AgentRole.CLONE && (
                   <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                        <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase tracking-wider">
                            {userProfile.name}
                        </span>
                   </div>
                )}
                
                <div className="font-light">
                    {msg.role === AgentRole.CLONE ? (
                        <TypewriterText text={msg.content} speed={10} />
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                           <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>

            {/* Internal Thoughts Display (Only for Clone) */}
            {msg.role === AgentRole.CLONE && msg.internalThoughts && (
                <div className="flex flex-col gap-2 mt-1 ml-4 animate-fade-in opacity-80 max-w-[80%]">
                    {/* Connector Line */}
                    <div className="h-4 w-0.5 bg-gray-800 ml-6"></div>
                    
                    {/* Primary Thought */}
                    <div className="flex gap-3 group">
                        <div className="mt-1 h-6 w-6 min-w-[24px] rounded-full bg-cyan-900/40 border border-cyan-800 flex items-center justify-center">
                            <span className="text-[10px] text-cyan-500 font-bold">P</span>
                        </div>
                        <div className="text-xs text-cyan-300/60 font-mono italic p-2 rounded bg-black/20 border border-transparent group-hover:border-cyan-900/50 transition-colors">
                            "{msg.internalThoughts.find(t => t.role === AgentRole.PRIMARY)?.content}"
                        </div>
                    </div>

                    {/* Meta Thought */}
                    <div className="flex gap-3 group">
                        <div className="mt-1 h-6 w-6 min-w-[24px] rounded-full bg-purple-900/40 border border-purple-800 flex items-center justify-center">
                            <span className="text-[10px] text-purple-500 font-bold">M</span>
                        </div>
                        <div className="text-xs text-purple-300/60 font-mono italic p-2 rounded bg-black/20 border border-transparent group-hover:border-purple-900/50 transition-colors">
                            "{msg.internalThoughts.find(t => t.role === AgentRole.META)?.content}"
                        </div>
                    </div>
                </div>
            )}
            
          </div>
        ))}

        {/* Loading State */}
        {isProcessing && (
           <div className="flex flex-col items-start gap-4 animate-pulse">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 ml-4">
                    <div className="flex gap-1">
                        <span className="h-2 w-2 bg-cyan-500 rounded-full animate-bounce"></span>
                        <span className="h-2 w-2 bg-purple-500 rounded-full animate-bounce delay-75"></span>
                        <span className="h-2 w-2 bg-white rounded-full animate-bounce delay-150"></span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">Running Duet Protocol...</span>
                </div>
           </div>
        )}
      </div>

      {/* Input Area */}
      <div className="relative">
        <form onSubmit={handleSend} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${userProfile.name} something...`}
                className="relative w-full bg-black/90 border border-gray-800 rounded-xl px-6 py-5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-700/50 transition-all font-light text-lg"
                disabled={isProcessing}
            />
            <button 
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-gray-800 hover:bg-cyan-900 text-cyan-400 rounded-lg transition-all disabled:opacity-0 disabled:scale-90"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
        </form>
        <div className="text-center mt-3">
             <p className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">
                AI may display hallucinated ideologies. Verify critical info.
             </p>
        </div>
      </div>

    </div>
  );
};