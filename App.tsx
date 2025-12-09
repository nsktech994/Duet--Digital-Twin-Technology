import React, { useState } from 'react';
import { Onboarding } from './components/Onboarding';
import { Simulation } from './components/Simulation';
import { UserProfile } from './types';

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
         {/* Cyan Blob */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[128px]"></div>
         {/* Purple Blob */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[128px]"></div>
        {/* Grid Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Top Bar */}
        <header className="px-6 md:px-8 py-6 flex justify-between items-center border-b border-white/5 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-black font-bold">D</span>
            </div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight">DUET <span className="font-light text-gray-500">| Digital Twin Interface</span></h1>
          </div>
          <div className="text-xs font-mono text-gray-600 hidden md:block">
            v2.0.1 • SYSTEM_ACTIVE
          </div>
        </header>

        {/* Main Stage */}
        <main className="flex-1 flex items-center justify-center p-4 md:p-6">
          {!userProfile ? (
            <Onboarding onComplete={setUserProfile} />
          ) : (
            <Simulation 
              userProfile={userProfile} 
              onBack={() => setUserProfile(null)} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;