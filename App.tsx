
import React, { useState } from 'react';
import { Onboarding } from './components/Onboarding';
import { Simulation } from './components/Simulation';
import { UserProfile } from './types';

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Background Ambience - Unified and subtle */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] bg-cyan-900/10 rounded-full blur-[160px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/10 rounded-full blur-[180px] animate-pulse-slow [animation-delay:2s]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-overlay"></div>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '100px 100px' }}></div>
      </div>

      {/* Header (Desktop Only / Hide when simulation is on mobile if needed) */}
      {!userProfile && (
        <header className="relative z-50 h-20 px-8 md:px-12 flex justify-between items-center border-b border-white/[0.03] backdrop-blur-3xl shrink-0 bg-black/20">
          <div className="flex items-center gap-5 group cursor-default">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center shadow-2xl shadow-cyan-500/30 group-hover:scale-110 transition-transform duration-500">
              <span className="text-black font-black text-lg">D</span>
            </div>
            <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight uppercase leading-none">
                  DUET <span className="text-neutral-600 font-light ml-2">SYSTEM</span>
                </h1>
                <span className="text-[8px] font-mono text-cyan-500/40 tracking-[0.5em] mt-1 uppercase">Parallel_Consciousness_Framework</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-6">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono text-cyan-500/60 uppercase tracking-widest">Global_Status</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Synchronized</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono text-purple-500/60 uppercase tracking-widest">Network</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Secure_Link</span>
                </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col h-full min-h-0">
        {!userProfile ? (
          <div className="flex-1 flex items-center justify-center p-6 md:p-12 overflow-y-auto scrollbar-hide">
            <div className="w-full flex justify-center animate-fade-in">
              <Onboarding onComplete={setUserProfile} />
            </div>
          </div>
        ) : (
          <Simulation 
            userProfile={userProfile} 
            onBack={() => setUserProfile(null)} 
          />
        )}
      </main>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.05); opacity: 0.15; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 10s ease-in-out infinite;
        }
        .animate-fade-in {
            animation: fade-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;
