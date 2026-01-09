
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, AgentRole, UserProfile, Attachment, ContextNode, ContextNodeType } from '../types';
import { chatWithClone, fetchLinkContent } from '../services/geminiService';
import { TypewriterText } from './TypewriterText';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface SimulationProps {
  userProfile: UserProfile;
  onBack: () => void;
}

type Emotion = 'neutral' | 'empathetic' | 'intense' | 'thoughtful' | 'joyful' | 'somber';

const PixelConsciousness: React.FC<{ amplitude: number; emotion: Emotion; processing: boolean; size?: string }> = ({ amplitude, emotion, processing, size = "full" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      }
    }, 3000);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = size === "small" ? 16 : 32;
    const cellSize = canvas.width / gridSize;
    let particles: { x: number; y: number; brightness: number; speed: number; offset: number }[] = [];

    for (let i = 0; i < gridSize * gridSize; i++) {
      particles.push({
        x: i % gridSize,
        y: Math.floor(i / gridSize),
        brightness: Math.random(),
        speed: Math.random() * (size === "small" ? 0.08 : 0.04) + 0.01,
        offset: Math.random() * Math.PI * 2
      });
    }

    const getColor = (emotion: Emotion, opacity: number) => {
      switch (emotion) {
        case 'joyful': return `rgba(34, 211, 238, ${opacity})`;
        case 'somber': return `rgba(96, 165, 250, ${opacity})`;
        case 'intense': return `rgba(168, 85, 247, ${opacity})`;
        case 'empathetic': return `rgba(52, 211, 153, ${opacity})`;
        case 'thoughtful': return `rgba(251, 191, 36, ${opacity})`;
        default: return `rgba(103, 232, 249, ${opacity})`;
      }
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pulseBase = Math.sin(time / 800) * 0.2 + 0.8;
      
      particles.forEach((p) => {
        p.brightness += p.speed * (processing ? 4 : 1);
        if (p.brightness > 1) p.brightness = 0;

        const centerX = gridSize / 2;
        const centerY = gridSize / 2;
        const isEyeArea = (Math.abs(p.y - gridSize * 0.35) < 2) && (Math.abs(p.x - gridSize * 0.3) < 2 || Math.abs(p.x - gridSize * 0.7) < 2);
        
        let isMouthArea = false;
        const mouthY = gridSize * 0.65;
        const mouthXDist = Math.abs(p.x - centerX);
        
        if (emotion === 'joyful') {
           const curve = Math.pow(mouthXDist / (gridSize * 0.2), 2) * 1.5;
           isMouthArea = Math.abs(p.y - (mouthY + curve)) < 1 && mouthXDist < gridSize * 0.25;
        } else if (emotion === 'somber') {
           const curve = Math.pow(mouthXDist / (gridSize * 0.2), 2) * -1.5;
           isMouthArea = Math.abs(p.y - (mouthY + curve)) < 1 && mouthXDist < gridSize * 0.25;
        } else {
           isMouthArea = Math.abs(p.y - mouthY) < 0.8 && mouthXDist < gridSize * 0.2;
        }

        let featureMultiplier = 1;
        if (isEyeArea) featureMultiplier = blink ? 0.2 : 2.5;
        if (isMouthArea) featureMultiplier = 2.2;

        const dist = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
        const normalizedDist = dist / (gridSize / 1.3);
        
        let activeOpacity = (1 - normalizedDist) * p.brightness * pulseBase * featureMultiplier;
        if (processing) activeOpacity *= 1.5;
        activeOpacity = Math.max(0, Math.min(1, activeOpacity + amplitude * 2));

        if (activeOpacity > 0.02) {
          ctx.fillStyle = getColor(emotion, activeOpacity);
          const drawSize = cellSize * (0.8 + amplitude * 0.5);
          const jitter = (processing || emotion === 'intense') ? (Math.random() - 0.5) * 1.5 : 0;
          ctx.fillRect(p.x * cellSize + jitter, p.y * cellSize + jitter, drawSize, drawSize);
        }
      });
      animationRef.current = requestAnimationFrame(render);
    };
    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [emotion, processing, amplitude, size, blink]);

  return <canvas ref={canvasRef} width={size === "small" ? 120 : 400} height={size === "small" ? 120 : 400} className="w-full h-full opacity-90 mix-blend-screen" />;
};

export const Simulation: React.FC<SimulationProps> = ({ userProfile, onBack }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [textAmplitude, setTextAmplitude] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [syncLevel, setSyncLevel] = useState(94);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [contextNodes, setContextNodes] = useState<ContextNode[]>([]);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [newNodeType, setNewNodeType] = useState<ContextNodeType>('link');
  const [newNodeValue, setNewNodeValue] = useState('');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodeFileInputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const effectiveAmplitude = useMemo(() => Math.max(audioAmplitude, textAmplitude), [audioAmplitude, textAmplitude]);
  
  useEffect(() => {
    const interval = setInterval(() => {
        setSyncLevel(prev => {
            const drift = (Math.random() - 0.5) * 0.2;
            const target = isProcessing ? 99.9 : 99.2;
            const next = prev + (target - prev) * 0.4 + drift;
            return Math.min(100, Math.max(92, next));
        });
    }, 600);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const updateEmotion = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.length > 400 || lower.includes("must") || lower.includes("critical")) setCurrentEmotion('intense');
    else if (lower.includes("happy") || lower.includes("joy")) setCurrentEmotion('joyful');
    else if (lower.includes("sorry") || lower.includes("sad")) setCurrentEmotion('somber');
    else if (lower.includes("perhaps") || lower.includes("analyze")) setCurrentEmotion('thoughtful');
    else if (lower.includes("feel") || lower.includes("connect")) setCurrentEmotion('empathetic');
    else setCurrentEmotion('neutral');
  };

  useEffect(() => {
    let interval: number;
    if (isTyping) {
      let frame = 0;
      interval = window.setInterval(() => {
        frame++;
        setTextAmplitude(Math.abs(Math.sin(frame * 0.5)) * 0.3 + Math.random() * 0.2);
      }, 80);
    } else setTextAmplitude(0);
    return () => clearInterval(interval);
  }, [isTyping]);

  const downloadText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadAttachment = (att: Attachment) => {
    const byteCharacters = atob(att.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: att.mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name || `attachment_${Date.now()}.png`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isNode: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (isNode) addContextNode('file', file.name, base64, file.type);
      else setPendingAttachments(prev => [...prev, { mimeType: file.type, data: base64, name: file.name }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addContextNode = async (type: ContextNodeType, title: string, content: string, mimeType?: string) => {
    if (!content.trim()) return;
    
    const id = Math.random().toString(36).substr(2, 9);
    const newNode: ContextNode = {
      id,
      type,
      title: title || (type === 'link' ? "New Perspective Link" : `Node_${Date.now()}`),
      content,
      mimeType,
      timestamp: Date.now(),
      status: type === 'link' ? 'fetching' : 'ready'
    };
    
    setContextNodes(prev => [...prev, newNode]);
    setShowNodeModal(false);
    setNewNodeValue('');
    setNewNodeTitle('');

    if (type === 'link') {
      try {
        const { title: fetchedTitle, summary } = await fetchLinkContent(content);
        setContextNodes(prev => prev.map(node => 
          node.id === id ? { ...node, title: fetchedTitle, content: summary, status: 'ready' } : node
        ));
      } catch (err) {
        setContextNodes(prev => prev.map(node => 
          node.id === id ? { ...node, status: 'error', title: "Fetch Failed" } : node
        ));
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || isProcessing) return;
    const userMsg: AgentMessage = { id: Date.now().toString(), role: AgentRole.USER, content: input, timestamp: Date.now(), attachments: [...pendingAttachments] };
    setMessages(prev => [...prev, userMsg]);
    updateEmotion(input);
    const currentInput = input;
    const currentAttachments = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    setIsProcessing(true);
    try {
      const response = await chatWithClone(messages, currentInput, userProfile, currentAttachments, contextNodes.filter(n => n.status === 'ready'));
      const newCloneMsg: AgentMessage = { 
        id: (Date.now() + 1).toString(), 
        role: AgentRole.CLONE, 
        content: response.finalResponse, 
        timestamp: Date.now(), 
        internalThoughts: [
          { role: AgentRole.PRIMARY, content: response.primaryThought }, 
          { role: AgentRole.META, content: response.metaThought }
        ]
      };
      if (response.sketchUrl) {
        newCloneMsg.attachments = [{ mimeType: 'image/png', data: response.sketchUrl.split(',')[1], name: `SKETCH_${Date.now()}.png` }];
      }
      setMessages(prev => [...prev, newCloneMsg]);
      updateEmotion(response.finalResponse);
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  const toggleThought = (id: string) => {
    setExpandedThoughtIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const auraColor = useMemo(() => {
    switch (currentEmotion) {
      case 'joyful': return 'rgba(34, 211, 238, 0.4)';
      case 'somber': return 'rgba(96, 165, 250, 0.25)';
      case 'intense': return 'rgba(168, 85, 247, 0.5)';
      case 'empathetic': return 'rgba(52, 211, 153, 0.3)';
      case 'thoughtful': return 'rgba(251, 191, 36, 0.25)';
      default: return 'rgba(103, 232, 249, 0.2)';
    }
  }, [currentEmotion]);

  const stopLiveSession = () => {
    if (liveSessionRef.current) { liveSessionRef.current.close(); liveSessionRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.input.close(); audioContextRef.current.output.close(); audioContextRef.current = null; }
    setIsLiveActive(false);
    setAudioAmplitude(0);
  };

  const startLiveSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      audioContextRef.current = { input: inputCtx, output: outputCtx };
      setIsLiveActive(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
              const dataInt16 = new Int16Array(bytes.buffer);
              const frameCount = dataInt16.length;
              const buffer = outputCtx.createBuffer(1, frameCount, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(analyser);
              analyser.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => stopLiveSession(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are simulating the consciousness of ${userProfile.name}.`,
        },
      });
      liveSessionRef.current = await sessionPromise;
      const updateAmplitude = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioAmplitude((dataArray.reduce((a, b) => a + b) / dataArray.length) / 128);
        if (setIsLiveActive) requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();
    } catch (err) { setIsLiveActive(false); }
  };

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row bg-[#020202] overflow-hidden font-sans">
      
      {/* DESKTOP SIDEBAR: Cognitive Registry */}
      <aside className={`hidden lg:flex flex-col border-r border-white/5 backdrop-blur-3xl bg-black/40 z-20 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-80'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between overflow-hidden">
           {!isSidebarCollapsed && (
             <div className="flex flex-col animate-fade-in whitespace-nowrap">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">Cognitive_Registry</span>
                <span className="text-[8px] font-mono text-neutral-600 uppercase">Identity Matrix v5.0</span>
             </div>
           )}
           <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-2 rounded-xl bg-white/5 text-neutral-500 hover:text-cyan-400 transition-all ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
             <svg className={`w-4 h-4 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
           </button>
        </div>
        
        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="p-5 border-b border-white/5 bg-cyan-950/[0.03]">
               <div className="flex justify-between items-center mb-5">
                  <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Ideological_Nodes</span>
                  <button onClick={() => setShowNodeModal(true)} className="text-[10px] font-mono text-cyan-400 hover:text-white transition-all bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">Inject</button>
               </div>
               <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-hide">
                  {contextNodes.length === 0 && <div className="text-[9px] font-mono text-neutral-700 text-center py-6 italic">Void: Inject Data Streams</div>}
                  {contextNodes.map(node => (
                    <div key={node.id} className={`bg-white/[0.02] border border-white/[0.05] p-3 rounded-2xl flex items-center gap-3 group transition-all ${node.status === 'error' ? 'border-red-500/30' : ''}`}>
                       <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'fetching' ? 'bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.5)]' : node.status === 'error' ? 'bg-red-500' : node.type === 'link' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]' : 'bg-purple-400'}`}></div>
                       <div className="flex flex-col flex-1 min-w-0">
                          <div className="text-[10px] text-neutral-300 font-medium truncate uppercase tracking-tight">{node.title}</div>
                          {node.status === 'fetching' && <div className="text-[7px] font-mono text-yellow-500/60 uppercase">Analysing Link...</div>}
                          {node.status === 'error' && <div className="text-[7px] font-mono text-red-500/60 uppercase">Injection Failed</div>}
                       </div>
                       <button onClick={() => setContextNodes(prev => prev.filter(n => n.id !== node.id))} className="ml-auto text-neutral-700 group-hover:text-red-400 transition-colors px-1">✕</button>
                    </div>
                  ))}
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">Neural_Fragments</span>
                {messages.filter(m => m.role === AgentRole.USER).slice(-8).map(msg => (
                    <div key={msg.id} className="text-[10px] text-neutral-500 border-l border-white/10 pl-4 py-2 font-light leading-relaxed italic animate-message-in">"{msg.content.substring(0, 80)}{msg.content.length > 80 ? '...' : ''}"</div>
                ))}
            </div>
          </div>
        )}
      </aside>

      {/* MOBILE MESSAGING HEADER */}
      <header className="lg:hidden h-24 bg-black/80 backdrop-blur-3xl border-b border-white/5 px-6 flex items-center justify-between z-50">
          <button onClick={onBack} className="w-11 h-11 flex items-center justify-center text-neutral-500 bg-white/5 rounded-2xl active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
          <div className="flex flex-col items-center flex-1 mx-4">
              <span className="text-sm font-bold text-cyan-50 font-sans tracking-tight uppercase truncate max-w-[120px]">{userProfile.name}</span>
              <div className="flex items-center gap-2 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_cyan]' : 'bg-green-500'}`}></div>
                  <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">{isProcessing ? 'Simulating...' : `${syncLevel.toFixed(0)}% SYNC`}</span>
              </div>
          </div>
          <div className="w-14 h-14 relative flex items-center justify-center bg-cyan-950/20 rounded-2xl border border-white/[0.08] shadow-inner overflow-hidden">
              <PixelConsciousness amplitude={effectiveAmplitude} emotion={currentEmotion} processing={isProcessing} size="small" />
          </div>
      </header>

      {/* CHAT ARENA */}
      <main className="flex-1 relative flex flex-col bg-[#050505] min-w-0">
        
        {/* Generative Background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute w-full h-full opacity-20 transition-all duration-1000" style={{ background: `radial-gradient(circle at 50% 50%, ${auraColor} 0%, rgba(0,0,0,0) 80%)` }}></div>
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.5px, transparent 0.5px)', backgroundSize: '36px 36px' }}></div>
        </div>

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-10 lg:px-20 py-10 space-y-10 z-10 scrollbar-hide pb-40 max-w-6xl mx-auto w-full">
           {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full opacity-20 pointer-events-none">
                <div className="w-40 h-40 mb-8 grayscale brightness-150">
                    <PixelConsciousness amplitude={0.05} emotion="neutral" processing={false} />
                </div>
                <div className="text-[11px] font-mono uppercase tracking-[0.6em] text-cyan-400">Establish_Perception_Link</div>
             </div>
           )}
           {messages.map((msg, idx) => (
             <div key={msg.id} className={`flex flex-col ${msg.role === AgentRole.USER ? 'items-end' : 'items-start'} animate-message-in`}>
                
                <div className={`group relative max-w-[95%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] rounded-[2rem] p-6 ${
                  msg.role === AgentRole.USER 
                    ? 'bg-gradient-to-br from-cyan-600/10 to-cyan-800/10 border border-cyan-500/15 text-cyan-50 text-sm font-light' 
                    : 'bg-[#111]/80 border border-white/[0.08] text-neutral-100 text-sm leading-relaxed backdrop-blur-3xl shadow-2xl'
                }`}>
                   <div className={`absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button 
                        onClick={() => downloadText(msg.content, `message_${msg.id}`)}
                        className="p-2 bg-black/40 hover:bg-cyan-500/20 rounded-xl text-neutral-400 hover:text-cyan-400 transition-all backdrop-blur-md border border-white/5"
                      >
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-3-3m3 3l3-3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" /></svg>
                      </button>
                   </div>

                   {msg.role === AgentRole.CLONE && idx === messages.length - 1 ? (
                     <TypewriterText text={msg.content} speed={6} onStart={() => setIsTyping(true)} onComplete={() => setIsTyping(false)} />
                   ) : (
                     <ReactMarkdown className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">{msg.content}</ReactMarkdown>
                   )}

                   {msg.attachments?.map((att, i) => (
                     <div key={i} className="mt-6 relative rounded-2xl overflow-hidden border border-white/[0.05] bg-black/40 group/att transition-all duration-500">
                        <img src={`data:image/png;base64,${att.data}`} alt="Visualization" className="w-full h-auto brightness-90 group-hover/att:brightness-105 transition-all duration-1000" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                           <button onClick={() => downloadAttachment(att)} className="px-6 py-3 bg-cyan-500 text-black font-bold text-[10px] uppercase tracking-widest rounded-full shadow-2xl active:scale-95 transition-transform">Download Perception</button>
                        </div>
                     </div>
                   ))}

                   {msg.internalThoughts && (
                     <div className="mt-5 pt-5 border-t border-white/[0.05]">
                        <button 
                          onClick={() => toggleThought(msg.id)} 
                          className="text-[10px] font-mono text-cyan-400/40 uppercase tracking-[0.25em] flex items-center gap-2.5 hover:text-cyan-400 transition-all active:scale-95"
                        >
                          {expandedThoughtIds.has(msg.id) ? 'Hide_Cognition' : 'Deconstruct_Logic'}
                          <svg className={`w-3 h-3 transition-transform duration-300 ${expandedThoughtIds.has(msg.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        
                        {expandedThoughtIds.has(msg.id) && (
                          <div className="mt-5 space-y-4 animate-fade-in">
                             {msg.internalThoughts.map((t, i) => (
                               <div key={i} className={`p-4 rounded-[1.25rem] text-[10px] font-mono leading-relaxed border ${t.role === AgentRole.PRIMARY ? 'bg-cyan-500/[0.02] text-cyan-400/60 border-cyan-500/10' : 'bg-purple-500/[0.02] text-purple-400/60 border-purple-500/10'}`}>
                                  <div className="text-[7px] font-bold uppercase mb-2 opacity-40 tracking-widest">{t.role}</div>
                                  {t.content}
                               </div>
                             ))}
                          </div>
                        )}
                     </div>
                   )}
                </div>
             </div>
           ))}
           {isProcessing && !isTyping && (
             <div className="flex items-center gap-4 text-cyan-400/50 font-mono text-[10px] animate-pulse pl-4">
                <span className="flex gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></span><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]"></span></span>
                Synthesizing_Parallel_Streams...
             </div>
           )}
        </div>

        {/* MESSAGING DOCK */}
        <div className="absolute bottom-0 w-full p-6 lg:p-10 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
           <div className="max-w-4xl mx-auto flex items-center gap-3 p-3 bg-[#0d0d0d]/95 rounded-[2.5rem] border border-white/[0.08] backdrop-blur-3xl shadow-2xl">
              <button 
                type="button" 
                onClick={() => setIsRegistryOpen(!isRegistryOpen)} 
                className={`lg:hidden w-12 h-12 flex items-center justify-center rounded-2xl transition-all bg-white/[0.03] ${isRegistryOpen ? 'text-cyan-400 border border-cyan-500/30' : 'text-neutral-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h9" /></svg>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center text-neutral-500 hover:text-cyan-400 transition-all bg-white/[0.03] rounded-2xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </button>
              <form onSubmit={handleSend} className="flex-1 flex items-center gap-3">
                 <input 
                   ref={inputRef}
                   type="text" 
                   value={input} 
                   onChange={(e) => setInput(e.target.value)} 
                   placeholder="Engage subjective reality..." 
                   className="flex-1 bg-transparent border-none py-3 text-white placeholder-neutral-800 focus:outline-none text-sm md:text-base font-light px-2"
                   disabled={isProcessing}
                 />
                 <div className="flex items-center gap-2 pr-1">
                    <button 
                    type="button" 
                    onClick={isLiveActive ? stopLiveSession : startLiveSession} 
                    className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${isLiveActive ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/[0.03] text-neutral-500 hover:text-cyan-400'}`}
                    >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m8 0h-3m4-8a3 3 0 01-3 3H9a3 3 0 01-3-3V5a3 3 0 013-3h6a3 3 0 013 3v6z" /></svg>
                    </button>
                    <button 
                    type="submit" 
                    disabled={!input.trim() || isProcessing}
                    className="w-11 h-11 flex items-center justify-center bg-cyan-500 text-black rounded-2xl disabled:opacity-20 shadow-xl active:scale-90 transition-transform"
                    >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="4" d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                 </div>
              </form>
           </div>
        </div>
      </main>

      {/* MOBILE REGISTRY DRAWER */}
      <div className={`fixed inset-0 z-[60] lg:hidden transition-all duration-500 ${isRegistryOpen ? 'visible' : 'invisible'}`}>
          <div className={`absolute inset-0 bg-black/80 backdrop-blur-2xl transition-opacity duration-500 ${isRegistryOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsRegistryOpen(false)}></div>
          <div className={`absolute bottom-0 left-0 right-0 h-[75vh] bg-[#0a0a0a] border-t border-white/[0.08] rounded-t-[3rem] p-8 shadow-2xl transition-transform duration-500 ease-out ${isRegistryOpen ? 'translate-y-0' : 'translate-y-full'}`}>
              <div className="w-14 h-1.5 bg-neutral-800 rounded-full mx-auto mb-10"></div>
              <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-cyan-50 font-sans tracking-tight uppercase">Registry</h3>
                  <button onClick={() => setShowNodeModal(true)} className="px-5 py-2.5 bg-cyan-500 text-black text-[10px] font-bold font-mono uppercase rounded-full tracking-widest active:scale-95 transition-transform">Inject Node</button>
              </div>
              <div className="space-y-4 overflow-y-auto h-[50vh] scrollbar-hide">
                  {contextNodes.map(node => (
                    <div key={node.id} className={`p-5 bg-white/[0.03] border border-white/[0.05] rounded-3xl flex items-center justify-between ${node.status === 'error' ? 'border-red-500/20' : ''}`}>
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest px-2 py-0.5 bg-cyan-500/10 w-fit rounded font-bold">{node.type}</span>
                            <span className="text-sm font-medium text-white tracking-tight truncate pr-4">{node.title}</span>
                            {node.status === 'fetching' && <span className="text-[8px] text-yellow-500 font-mono animate-pulse">INGESTING DATA...</span>}
                            {node.status === 'error' && <span className="text-[8px] text-red-500 font-mono">LINK ANALYSIS FAILED</span>}
                        </div>
                        <button onClick={() => setContextNodes(prev => prev.filter(n => n.id !== node.id))} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-400 rounded-full active:scale-90">✕</button>
                    </div>
                  ))}
                  {contextNodes.length === 0 && <div className="text-center py-20 text-neutral-600 font-mono text-xs">NO NODES ACTIVE</div>}
              </div>
          </div>
      </div>

      {/* NODE INJECTION MODAL */}
      {showNodeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6">
             <div className="w-full max-w-lg p-10 bg-[#0d0d0d] border border-white/[0.08] rounded-[3rem] relative animate-message-in shadow-2xl">
                <button onClick={() => setShowNodeModal(false)} className="absolute top-10 right-10 text-neutral-600 hover:text-white transition-all text-2xl active:scale-90">✕</button>
                <h3 className="text-2xl font-bold text-cyan-50 mb-10 tracking-tight">Injection Portal</h3>
                <div className="flex gap-2 mb-10 bg-white/[0.03] p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
                   {(['link', 'file', 'text'] as ContextNodeType[]).map(type => (
                     <button key={type} onClick={() => setNewNodeType(type)} className={`flex-1 min-w-[80px] py-3.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${newNodeType === type ? 'bg-cyan-500 text-black shadow-xl shadow-cyan-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}>{type}</button>
                   ))}
                </div>
                <div className="space-y-6">
                   <input type="text" value={newNodeTitle} onChange={e => setNewNodeTitle(e.target.value)} placeholder="Node Descriptor (Optional)" className="w-full bg-white/[0.03] border border-white/[0.05] rounded-2xl px-6 py-5 text-white text-sm focus:border-cyan-500/40 outline-none transition-all placeholder-neutral-800" />
                   {newNodeType === 'file' ? (
                     <button onClick={() => nodeFileInputRef.current?.click()} className="w-full py-16 border-2 border-dashed border-white/[0.08] rounded-[2.5rem] text-neutral-600 text-xs font-mono uppercase tracking-[0.3em] hover:border-cyan-500/40 transition-all hover:bg-cyan-500/[0.01]">Upload Fragment</button>
                   ) : (
                     <textarea value={newNodeValue} onChange={e => setNewNodeValue(e.target.value)} placeholder={newNodeType === 'link' ? "https://example.com/philosophy-trace" : "Inject ideological text fragment here..."} className="w-full h-44 bg-white/[0.03] border border-white/[0.05] rounded-[2.5rem] px-8 py-6 text-white text-sm font-light resize-none focus:border-cyan-500/40 outline-none transition-all placeholder-neutral-800" />
                   )}
                </div>
                <button 
                  onClick={() => newNodeType !== 'file' && addContextNode(newNodeType, newNodeTitle, newNodeValue)} 
                  disabled={newNodeType !== 'file' && !newNodeValue.trim()} 
                  className="w-full mt-10 py-6 bg-gradient-to-br from-cyan-600 to-cyan-400 text-black font-bold uppercase tracking-[0.3em] rounded-[2.5rem] shadow-2xl active:scale-95 transition-all text-xs disabled:opacity-20"
                >
                  {newNodeType === 'link' ? 'Analyze & Ingest' : 'Authorize Injection'}
                </button>
                <input type="file" ref={nodeFileInputRef} onChange={(e) => handleFileUpload(e, true)} className="hidden" />
             </div>
          </div>
        )}

      <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e)} className="hidden" accept="image/*,.pdf,.txt" />

      <style>{`
        @keyframes message-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-message-in { animation: message-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};
