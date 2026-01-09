
import React, { useState } from 'react';
import { Onboarding } from './components/Onboarding';
import { Simulation } from './components/Simulation';
import { UserProfile } from './types';

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-cyan-900/10 rounded-full blur-[100px] md:blur-[128px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-purple-900/10 rounded-full blur-[100px] md:blur-[128px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1]"></div>
      </div>

      {/* Header (Hidden when Simulation is active on Mobile to maximize chat space) */}
      {!userProfile && (
        <header className="relative z-50 h-16 px-6 md:px-8 flex justify-between items-center border-b border-white/5 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-black font-bold text-sm">D</span>
            </div>
            <h1 className="text-base font-bold tracking-tight uppercase">
              DUET <span className="hidden sm:inline font-light text-gray-500 lowercase px-2">| Perception Simulation</span>
            </h1>
          </div>
          <div className="text-[10px] font-mono text-cyan-500/50 tracking-widest hidden sm:block">
            STREAMS: ACTIVE
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col h-full">
        {!userProfile ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Onboarding onComplete={setUserProfile} />
          </div>
        ) : (
          <Simulation 
            userProfile={userProfile} 
            onBack={() => setUserProfile(null)} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
