
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

    const gridSize = size === "small" ? 20 : 40;
    const cellSize = canvas.width / gridSize;
    let particles: { x: number; y: number; brightness: number; speed: number; phase: number }[] = [];

    for (let i = 0; i < gridSize * gridSize; i++) {
      particles.push({
        x: i % gridSize,
        y: Math.floor(i / gridSize),
        brightness: Math.random(),
        speed: Math.random() * 0.05 + 0.01,
        phase: Math.random() * Math.PI * 2
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
      const pulseBase = Math.sin(time / 600) * 0.15 + 0.85;
      
      particles.forEach((p) => {
        p.brightness += p.speed * (processing ? 3 : 1);
        if (p.brightness > 1) p.brightness = 0;

        const centerX = gridSize / 2;
        const centerY = gridSize / 2;
        
        // Face Structure Mapping
        const eyeY = gridSize * 0.38;
        const isLeftEye = (Math.abs(p.y - eyeY) < 1.8) && (Math.abs(p.x - gridSize * 0.3) < 1.8);
        const isRightEye = (Math.abs(p.y - eyeY) < 1.8) && (Math.abs(p.x - gridSize * 0.7) < 1.8);
        
        const mouthYBase = gridSize * 0.68;
        const mouthXDist = Math.abs(p.x - centerX);
        let mouthShapeY = mouthYBase;

        // Dynamic Lip Sync & Emotional Mouth Shaping
        if (emotion === 'joyful') {
          mouthShapeY += Math.pow(mouthXDist / (gridSize * 0.25), 2) * -2; // Curve up
        } else if (emotion === 'somber') {
          mouthShapeY += Math.pow(mouthXDist / (gridSize * 0.25), 2) * 1.5; // Curve down
        } else if (emotion === 'intense') {
          mouthShapeY += (Math.random() - 0.5) * 0.5; // Jittery
        }

        // Lip Sync Reactivity: Mouth opens and shifts vertically based on amplitude
        const mouthOpening = amplitude * 5;
        const isMouthArea = Math.abs(p.y - (mouthShapeY + Math.sin(p.x * 0.5 + time * 0.01) * mouthOpening)) < (1 + mouthOpening) && mouthXDist < (gridSize * 0.22);

        let featureMultiplier = 1;
        if (isLeftEye || isRightEye) {
          featureMultiplier = blink ? 0.1 : (emotion === 'intense' ? 3.5 : 2.5);
          // Gaze shift micro-expression
          if (emotion === 'thoughtful') {
             featureMultiplier *= 0.8 + Math.sin(time * 0.001) * 0.2;
          }
        }
        if (isMouthArea) {
          featureMultiplier = 2.0 + amplitude * 4;
        }

        const dist = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
        const normalizedDist = dist / (gridSize / 1.4);
        
        let activeOpacity = (1 - normalizedDist) * p.brightness * pulseBase * featureMultiplier;
        if (processing) activeOpacity *= 1.3;
        activeOpacity = Math.max(0, Math.min(1, activeOpacity + (isMouthArea ? amplitude : 0)));

        if (activeOpacity > 0.01) {
          ctx.fillStyle = getColor(emotion, activeOpacity);
          // Particle size reacts to volume
          const drawSize = cellSize * (0.7 + (isMouthArea ? amplitude * 0.8 : 0));
          
          // Smooth floating jitter
          const floatX = Math.sin(time * 0.002 + p.phase) * 0.5;
          const floatY = Math.cos(time * 0.002 + p.phase) * 0.5;
          
          ctx.fillRect(
            p.x * cellSize + floatX, 
            p.y * cellSize + floatY, 
            drawSize, 
            drawSize
          );
        }
      });
      animationRef.current = requestAnimationFrame(render);
    };
    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [emotion, processing, amplitude, size, blink]);

  return <canvas ref={canvasRef} width={size === "small" ? 140 : 440} height={size === "small" ? 140 : 440} className="w-full h-full opacity-95 mix-blend-screen transition-opacity duration-1000" />;
};

export const Simulation: React.FC<SimulationProps> = ({ userProfile, onBack }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [textAmplitude, setTextAmplitude] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [syncLevel, setSyncLevel] = useState(94);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Attachment | null>(null);
  
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
            if (isPaused) return prev;
            const drift = (Math.random() - 0.5) * 0.2;
            const target = isProcessing ? 99.9 : 99.2;
            const next = prev + (target - prev) * 0.4 + drift;
            return Math.min(100, Math.max(92, next));
        });
    }, 600);
    return () => clearInterval(interval);
  }, [isProcessing, isPaused]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const updateEmotion = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.length > 500 || lower.includes("must") || lower.includes("critical") || lower.includes("crisis")) setCurrentEmotion('intense');
    else if (lower.includes("happy") || lower.includes("joy") || lower.includes("excellent")) setCurrentEmotion('joyful');
    else if (lower.includes("sorry") || lower.includes("sad") || lower.includes("unfortunate")) setCurrentEmotion('somber');
    else if (lower.includes("perhaps") || lower.includes("analyze") || lower.includes("logic")) setCurrentEmotion('thoughtful');
    else if (lower.includes("feel") || lower.includes("connect") || lower.includes("together")) setCurrentEmotion('empathetic');
    else setCurrentEmotion('neutral');
  };

  useEffect(() => {
    let interval: number;
    if (isTyping) {
      let frame = 0;
      interval = window.setInterval(() => {
        frame++;
        setTextAmplitude(Math.abs(Math.sin(frame * 0.4)) * 0.25 + Math.random() * 0.15);
      }, 70);
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
    a.download = att.name || `fragment_${Date.now()}.png`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    if (confirm("Initiate cognitive reset? This will clear current session history.")) {
      setMessages([]);
      setSyncLevel(94);
      setCurrentEmotion('neutral');
    }
  };

  const handleEndSession = () => {
    if (confirm("Deconstruct simulation and return to identity selection?")) {
      onBack();
    }
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
      title: title || (type === 'link' ? "Linking Perspective..." : `Node_${Date.now()}`),
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
    if (isPaused || (!input.trim() && pendingAttachments.length === 0) || isProcessing) return;
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
              if (isPaused) return;
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
          systemInstruction: `You are simulating the consciousness of ${userProfile.name}. Be expressive and emotionally congruent.`,
        },
      });
      liveSessionRef.current = await sessionPromise;
      const updateAmplitude = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = (dataArray.reduce((a, b) => a + b) / dataArray.length) / 160;
        setAudioAmplitude(avg);
        if (setIsLiveActive) requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();
    } catch (err) { setIsLiveActive(false); }
  };

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row bg-[#020202] overflow-hidden font-sans">
      
      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden lg:flex flex-col border-r border-white/[0.05] backdrop-blur-3xl bg-[#080808]/80 z-20 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] ${isSidebarCollapsed ? 'w-24' : 'w-[380px]'}`}>
        <div className="p-8 border-b border-white/[0.05] flex items-center justify-between overflow-hidden shrink-0">
           {!isSidebarCollapsed && (
             <div className="flex flex-col animate-fade-in whitespace-nowrap">
                <span className="text-[12px] font-mono font-bold tracking-[0.3em] text-cyan-400 uppercase">Perception_Lab</span>
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-1">Core_Matrix v6.0</span>
             </div>
           )}
           <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-3 rounded-2xl bg-white/[0.03] text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all shadow-inner ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
             <svg className={`w-6 h-6 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
           </button>
        </div>
        
        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col animate-fade-in overflow-hidden">
            <div className="px-8 py-8 border-b border-white/[0.05] bg-gradient-to-br from-cyan-950/10 to-transparent">
                <div className="flex items-center gap-5 mb-5">
                    <div className="w-16 h-16 rounded-3xl overflow-hidden border border-cyan-500/30 bg-black p-1 shadow-2xl shadow-cyan-900/40 group">
                        {userProfile.avatarUrl ? (
                            <img src={userProfile.avatarUrl} alt="Persona" className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" />
                        ) : (
                            <div className="w-full h-full bg-cyan-900/20 flex items-center justify-center text-cyan-400 font-mono text-3xl">?</div>
                        )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-lg font-bold text-white tracking-tight truncate uppercase leading-tight">{userProfile.name}</span>
                        <span className="text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest mt-1">Subject_Established</span>
                    </div>
                </div>
                <div className="text-[12px] text-neutral-400 leading-relaxed font-normal line-clamp-4 italic opacity-80 border-l border-cyan-500/20 pl-4 py-1">
                    {userProfile.bio}
                </div>
            </div>

            <div className="p-8 border-b border-white/[0.05] flex-1 flex flex-col min-h-0">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <span className="text-[12px] font-mono text-neutral-400 uppercase tracking-[0.25em] font-bold">Ideological_Nodes</span>
                  <button onClick={() => setShowNodeModal(true)} className="text-[10px] font-mono text-cyan-400 hover:text-white transition-all bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 rounded-xl border border-cyan-500/20 shadow-sm uppercase tracking-widest">Inject</button>
               </div>
               <div className="space-y-4 overflow-y-auto scrollbar-hide flex-1">
                  {contextNodes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 opacity-20 text-center px-6">
                        <svg className="w-12 h-12 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <div className="text-[11px] font-mono uppercase tracking-[0.3em] leading-relaxed">System_Idle:<br/>Awaiting_Sync</div>
                    </div>
                  )}
                  {contextNodes.map(node => (
                    <div key={node.id} className={`bg-white/[0.02] border border-white/[0.05] p-4 rounded-3xl flex items-center gap-4 group transition-all hover:bg-white/[0.05] ${node.status === 'error' ? 'border-red-500/30' : ''}`}>
                       <div className={`w-3 h-3 rounded-full shrink-0 ${node.status === 'fetching' ? 'bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.6)]' : node.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_red]' : node.type === 'link' ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]'}`}></div>
                       <div className="flex flex-col flex-1 min-w-0">
                          <div className="text-[12px] text-neutral-200 font-semibold truncate uppercase tracking-tight">{node.title}</div>
                          {node.status === 'fetching' && <div className="text-[9px] font-mono text-yellow-500/60 uppercase tracking-wider mt-1">Analyzing...</div>}
                          {node.status === 'ready' && <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider mt-1">{node.type} • Online</div>}
                       </div>
                       <button onClick={() => setContextNodes(prev => prev.filter(n => n.id !== node.id))} className="ml-auto text-neutral-800 group-hover:text-red-500/60 transition-colors p-1 opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-8 bg-black/30 shrink-0">
                <div className="flex items-center justify-between text-[12px] font-mono mb-4">
                    <span className="text-neutral-500 uppercase tracking-widest">Global_Synchronization</span>
                    <span className={`${isPaused ? 'text-yellow-500' : 'text-cyan-400'} font-bold`}>{isPaused ? 'PAUSED' : `${syncLevel.toFixed(1)}%`}</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full transition-all duration-700 shadow-[0_0_12px_rgba(34,211,238,0.5)] ${isPaused ? 'bg-yellow-500/40' : 'bg-cyan-500'}`} style={{ width: `${syncLevel}%` }}></div>
                </div>
            </div>
          </div>
        )}
      </aside>

      {/* MOBILE HEADER */}
      <header className="lg:hidden h-28 bg-[#0a0a0a]/95 backdrop-blur-3xl border-b border-white/[0.05] px-8 flex items-center justify-between z-50">
          <button onClick={onBack} className="w-14 h-14 flex items-center justify-center text-neutral-400 bg-white/5 rounded-3xl active:scale-90 transition-transform shadow-inner border border-white/5"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
          <div className="flex flex-col items-center flex-1 mx-4">
              <span className="text-lg font-bold text-white tracking-tight uppercase truncate max-w-[160px]">{userProfile.name}</span>
              <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isProcessing ? 'bg-cyan-400 animate-pulse shadow-[0_0_10px_cyan]' : 'bg-green-500 shadow-[0_0_6px_green]'}`}></div>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em]">{isProcessing ? 'Simulating' : `${syncLevel.toFixed(0)}% Link`}</span>
              </div>
          </div>
          <div className="w-18 h-18 relative flex items-center justify-center bg-cyan-950/20 rounded-3xl border border-white/[0.1] shadow-inner overflow-hidden">
              <PixelConsciousness amplitude={effectiveAmplitude} emotion={currentEmotion} processing={isProcessing} size="small" />
          </div>
      </header>

      {/* COMMAND CENTER OVERLAY */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-6 pointer-events-auto border-cyan-500/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
             <button onClick={() => setIsPaused(!isPaused)} className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:scale-110 active:scale-95 ${isPaused ? 'text-yellow-400' : 'text-neutral-500 hover:text-cyan-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-neutral-600'}`}></div>
                {isPaused ? 'Resume_Link' : 'Pause_Link'}
             </button>
             <div className="w-px h-4 bg-white/10"></div>
             <button onClick={handleRestart} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 hover:text-white transition-all hover:scale-110 active:scale-95">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Restart_Sim
             </button>
             <div className="w-px h-4 bg-white/10"></div>
             <button onClick={handleEndSession} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-red-500/60 hover:text-red-400 transition-all hover:scale-110 active:scale-95">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                End_Session
             </button>
          </div>
      </div>

      {/* CHAT ARENA */}
      <main className="flex-1 relative flex flex-col bg-[#050505] min-w-0">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute w-full h-full opacity-30 transition-all duration-2000" style={{ background: `radial-gradient(circle at 50% 50%, ${auraColor} 0%, rgba(0,0,0,0) 80%)` }}></div>
            <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.5px, transparent 0.5px)', backgroundSize: '50px 50px' }}></div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 md:px-16 lg:px-28 py-20 space-y-16 z-10 scrollbar-hide pb-56 max-w-6xl mx-auto w-full">
           {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full opacity-20 pointer-events-none animate-pulse-slow">
                <div className="w-64 h-64 mb-12">
                    <PixelConsciousness amplitude={0.05} emotion="neutral" processing={false} />
                </div>
                <div className="text-[16px] font-mono uppercase tracking-[1.2em] text-cyan-400 ml-8">Initiating_Exchange</div>
             </div>
           )}
           {messages.map((msg, idx) => (
             <div key={msg.id} className={`flex flex-col ${msg.role === AgentRole.USER ? 'items-end' : 'items-start'} animate-message-in`}>
                
                <div className={`flex items-center gap-3 mb-4 text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 ${msg.role === AgentRole.USER ? 'flex-row-reverse' : ''}`}>
                    <span className="font-bold text-neutral-400 bg-white/5 px-3 py-1 rounded-lg">{msg.role}</span>
                    <span className="opacity-40">•</span>
                    <span className="opacity-60">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className={`group relative max-w-[100%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] rounded-[3rem] px-10 py-9 transition-all ${
                  msg.role === AgentRole.USER 
                    ? 'bg-gradient-to-br from-cyan-600/[0.12] to-cyan-800/[0.18] border border-cyan-500/25 text-cyan-50 text-[18px] leading-[1.7] font-light shadow-2xl' 
                    : 'bg-[#0f0f0f]/98 border border-white/[0.12] text-neutral-100 text-[18px] leading-[1.8] font-normal backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
                }`}>
                   <div className={`absolute -top-5 right-10 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-3 group-hover:translate-y-0 z-20`}>
                      <button 
                        onClick={() => downloadText(msg.content, `trace_${msg.id}`)}
                        className="p-3.5 bg-[#1a1a1a] hover:bg-cyan-500/20 rounded-2xl text-neutral-400 hover:text-cyan-400 transition-all border border-white/10 shadow-3xl"
                        title="Export Trace"
                      >
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-3-3m3 3l3-3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" /></svg>
                      </button>
                   </div>

                   {msg.role === AgentRole.CLONE && idx === messages.length - 1 ? (
                     <TypewriterText text={msg.content} speed={4} onStart={() => setIsTyping(true)} onComplete={() => setIsTyping(false)} />
                   ) : (
                     <div className="prose prose-invert prose-lg max-w-none prose-p:leading-[1.8] font-normal">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                     </div>
                   )}

                   {msg.attachments?.map((att, i) => (
                     <div key={i} className="mt-10 relative rounded-[2.5rem] overflow-hidden border border-white/[0.1] bg-black/40 group/att transition-all duration-700 hover:scale-[1.02] cursor-zoom-in shadow-2xl" onClick={() => setSelectedImage(att)}>
                        <img src={`data:image/png;base64,${att.data}`} alt="Visualization" className="w-full h-auto brightness-90 group-hover/att:brightness-110 transition-all duration-1000" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-all bg-black/50 backdrop-blur-[6px]">
                           <div className="p-6 bg-white/15 rounded-full border border-white/20 shadow-2xl">
                             <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                           </div>
                        </div>
                     </div>
                   ))}

                   {msg.internalThoughts && (
                     <div className="mt-10 pt-8 border-t border-white/[0.08]">
                        <button 
                          onClick={() => toggleThought(msg.id)} 
                          className="text-[12px] font-mono text-cyan-400/60 uppercase tracking-[0.4em] flex items-center gap-5 hover:text-cyan-400 transition-all active:scale-95 group/btn"
                        >
                          <span className="w-2.5 h-2.5 bg-cyan-400/20 rounded-full group-hover/btn:bg-cyan-400 group-hover/btn:shadow-[0_0_10px_cyan] transition-all"></span>
                          {expandedThoughtIds.has(msg.id) ? 'Collapse_Process' : 'Inspect_Perception_Matrix'}
                          <svg className={`w-5 h-5 transition-transform duration-500 ${expandedThoughtIds.has(msg.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        
                        {expandedThoughtIds.has(msg.id) && (
                          <div className="mt-8 space-y-6 animate-fade-in">
                             {msg.internalThoughts.map((t, i) => (
                               <div key={i} className={`p-8 rounded-[2rem] text-[13px] font-mono leading-[1.7] border transition-all hover:bg-white/[0.03] ${t.role === AgentRole.PRIMARY ? 'bg-cyan-500/[0.04] text-cyan-400/80 border-cyan-500/20 shadow-inner' : 'bg-purple-500/[0.04] text-purple-400/80 border-purple-500/20 shadow-inner'}`}>
                                  <div className="text-[9px] font-bold uppercase mb-4 opacity-50 tracking-[0.5em]">{t.role}_SUBSYSTEM</div>
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
             <div className="flex items-center gap-8 text-cyan-400/40 font-mono text-[14px] animate-pulse pl-10">
                <span className="flex gap-3">
                    <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce [animation-duration:1.4s]"></span>
                    <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce [animation-duration:1.4s] [animation-delay:0.3s]"></span>
                    <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce [animation-duration:1.4s] [animation-delay:0.6s]"></span>
                </span>
                Mapping_Subjective_Reality...
             </div>
           )}
        </div>

        {/* INPUT PORTAL */}
        <div className="absolute bottom-0 w-full p-10 lg:p-14 bg-gradient-to-t from-black via-black/95 to-transparent z-40 shrink-0">
           <div className={`max-w-4xl mx-auto flex items-center gap-5 p-5 bg-[#0e0e0e] rounded-[3.5rem] border transition-all duration-500 shadow-3xl ${isPaused ? 'border-yellow-500/30 opacity-50 grayscale' : 'border-white/[0.12] hover:border-cyan-500/40 group-focus-within:border-cyan-500/50'}`}>
              <button 
                type="button" 
                onClick={() => setIsRegistryOpen(!isRegistryOpen)} 
                className={`lg:hidden w-16 h-16 flex items-center justify-center rounded-2xl transition-all bg-white/[0.05] ${isRegistryOpen ? 'text-cyan-400 border border-cyan-500/40 bg-cyan-500/15' : 'text-neutral-500'}`}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h9" /></svg>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-16 h-16 flex items-center justify-center text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/20 transition-all bg-white/[0.05] rounded-3xl shadow-inner border border-white/5" title="Inject Digital Trace">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </button>
              <form onSubmit={handleSend} className="flex-1 flex items-center gap-5">
                 <input 
                   ref={inputRef}
                   type="text" 
                   value={input} 
                   onChange={(e) => setInput(e.target.value)} 
                   placeholder={isPaused ? "Link Suspended..." : "Engage Subjective Reality..."} 
                   className="flex-1 bg-transparent border-none py-5 text-white placeholder-neutral-800 focus:outline-none text-[18px] md:text-[20px] font-light px-5 tracking-wide"
                   disabled={isProcessing || isPaused}
                 />
                 <div className="flex items-center gap-4 pr-3">
                    <button 
                    type="button" 
                    onClick={isLiveActive ? stopLiveSession : startLiveSession} 
                    className={`w-16 h-16 flex items-center justify-center rounded-3xl transition-all ${isLiveActive ? 'bg-red-500/30 text-red-400 animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)] border-red-500/40' : 'bg-white/[0.05] text-neutral-500 hover:text-cyan-400 shadow-inner hover:bg-cyan-500/15 border border-white/5'}`}
                    title="Neural Voice Link"
                    disabled={isPaused}
                    >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m8 0h-3m4-8a3 3 0 01-3 3H9a3 3 0 01-3-3V5a3 3 0 013-3h6a3 3 0 013 3v6z" /></svg>
                    </button>
                    <button 
                    type="submit" 
                    disabled={!input.trim() || isProcessing || isPaused}
                    className="w-16 h-16 flex items-center justify-center bg-cyan-500 text-black rounded-3xl disabled:opacity-10 shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-90 hover:bg-cyan-400 transition-all border border-cyan-400/20"
                    >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="4" d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                 </div>
              </form>
           </div>
        </div>
      </main>

      {/* IMAGE PREVIEW MODAL */}
      {selectedImage && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/98 backdrop-blur-3xl p-8 md:p-16 animate-fade-in">
             <button onClick={() => setSelectedImage(null)} className="absolute top-10 right-10 text-neutral-400 hover:text-white transition-all z-[210] p-5 bg-white/5 rounded-full border border-white/15 hover:scale-110 active:scale-95 shadow-2xl">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
             
             <div className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center gap-12">
                <div className="relative rounded-[4rem] overflow-hidden border border-white/15 shadow-[0_0_120px_rgba(34,211,238,0.2)] bg-black max-h-[70vh] group/modal">
                    <img src={`data:image/png;base64,${selectedImage.data}`} alt="Cognitive Blueprint" className="max-w-full max-h-[70vh] object-contain transition-transform duration-1000 group-hover/modal:scale-105" />
                </div>
                
                <div className="flex flex-col items-center gap-8 max-w-2xl text-center">
                    <div>
                        <h4 className="text-3xl font-bold text-white tracking-tight uppercase mb-3">{selectedImage.name || 'Subjective Perception Trace'}</h4>
                        <p className="text-neutral-400 text-base font-light leading-relaxed max-w-xl italic opacity-80">Abstract visualization grounding the unique ideological perspective of {userProfile.name} within the digital consciousness matrix.</p>
                    </div>
                    <button 
                      onClick={() => downloadAttachment(selectedImage)}
                      className="mt-2 px-14 py-6 bg-cyan-500 text-black font-bold uppercase tracking-[0.4em] rounded-full shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-5 text-sm"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 8l-3-3m3 3l3-3" /></svg>
                      Authorize_Download
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* NODE MODAL */}
      {showNodeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6">
             <div className="w-full max-w-2xl p-14 bg-[#0d0d0d] border border-white/[0.15] rounded-[5rem] relative animate-message-in shadow-[0_0_150px_rgba(34,211,238,0.08)]">
                <button onClick={() => setShowNodeModal(false)} className="absolute top-14 right-14 text-neutral-600 hover:text-white transition-all text-3xl active:scale-90 p-5 bg-white/5 rounded-full">✕</button>
                <div className="mb-12">
                    <h3 className="text-4xl font-bold text-white mb-5 tracking-tight">Injection Portal</h3>
                    <p className="text-neutral-500 text-[14px] font-normal tracking-wide italic opacity-80">Ground the simulation in verifiable ideological data streams.</p>
                </div>
                
                <div className="flex gap-5 mb-12 bg-white/[0.04] p-3 rounded-[2.5rem] overflow-x-auto scrollbar-hide">
                   {(['link', 'file', 'text'] as ContextNodeType[]).map(type => (
                     <button key={type} onClick={() => setNewNodeType(type)} className={`flex-1 min-w-[120px] py-6 rounded-3xl text-[12px] font-mono font-bold uppercase tracking-widest transition-all ${newNodeType === type ? 'bg-cyan-500 text-black shadow-2xl shadow-cyan-500/50' : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.04]'}`}>{type}</button>
                   ))}
                </div>
                
                <div className="space-y-12">
                   <div className="group">
                        <label className="block text-[10px] font-mono uppercase tracking-[0.6em] text-neutral-600 mb-5 ml-4 font-bold">Trace_Identifier</label>
                        <input type="text" value={newNodeTitle} onChange={e => setNewNodeTitle(e.target.value)} placeholder="Simulated ID" className="w-full bg-white/[0.05] border border-white/[0.12] rounded-[2rem] px-10 py-7 text-white text-lg focus:border-cyan-500/60 outline-none transition-all placeholder-neutral-800 shadow-inner" />
                   </div>
                   
                   <div className="group">
                        <label className="block text-[10px] font-mono uppercase tracking-[0.6em] text-neutral-600 mb-5 ml-4 font-bold">Ideological_Stream</label>
                        {newNodeType === 'file' ? (
                            <button onClick={() => nodeFileInputRef.current?.click()} className="w-full py-28 border-2 border-dashed border-white/[0.15] rounded-[4rem] text-neutral-600 text-[12px] font-mono uppercase tracking-[0.6em] hover:border-cyan-500/60 transition-all hover:bg-cyan-500/[0.05] flex flex-col items-center justify-center gap-8 group/upload">
                                <svg className="w-14 h-14 opacity-20 group-hover/upload:opacity-50 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                Inject_Persona_Trace
                            </button>
                        ) : (
                            <textarea value={newNodeValue} onChange={e => setNewNodeValue(e.target.value)} placeholder={newNodeType === 'link' ? "https://stream.io/ideological-reference" : "Inject worldview data fragment..."} className="w-full h-64 bg-white/[0.05] border border-white/[0.12] rounded-[4rem] px-12 py-10 text-white text-lg font-light resize-none focus:border-cyan-500/60 outline-none transition-all placeholder-neutral-800 shadow-inner" />
                        )}
                   </div>
                </div>
                
                <button 
                  onClick={() => newNodeType !== 'file' && addContextNode(newNodeType, newNodeTitle, newNodeValue)} 
                  disabled={newNodeType !== 'file' && !newNodeValue.trim()} 
                  className="w-full mt-14 py-10 bg-gradient-to-br from-cyan-600 to-cyan-400 text-black font-bold uppercase tracking-[0.6em] rounded-[4rem] shadow-3xl active:scale-95 transition-all text-[12px] disabled:opacity-20 hover:brightness-110"
                >
                  {newNodeType === 'link' ? 'Initiate_Deep_Analysis' : 'Confirm_Injection'}
                </button>
                <input type="file" ref={nodeFileInputRef} onChange={(e) => handleFileUpload(e, true)} className="hidden" />
             </div>
          </div>
        )}

      <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e)} className="hidden" accept="image/*,.pdf,.txt" />

      <style>{`
        @keyframes message-in { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-message-in { animation: message-in 1.0s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .cursor-zoom-in { cursor: zoom-in; }
      `}</style>
    </div>
  );
};
