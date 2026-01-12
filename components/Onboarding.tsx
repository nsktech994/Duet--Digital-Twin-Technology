
import React, { useState } from 'react';
import { UserProfile, GroundingSource } from '../types';
import { searchUserBio, analyzeIdentity, generateAvatar } from '../services/geminiService';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'manual' | 'search'>('manual');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!name.trim()) return;
    setIsSearching(true);
    setError(null);
    setBio('');
    
    try {
      const result = await searchUserBio(name);
      setBio(result.bio);
      if (result.bio.includes("No bio found")) {
         setError("Could not find sufficient ideological data. Please enter profile manually.");
      }
    } catch (e) {
      setError("Connection to the consciousness grid failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bio) return;
    
    setIsAnalyzing(true);
    try {
        setLoadingStep('Mapping ideological landscape...');
        const finalBio = await analyzeIdentity(name, bio, links);
        
        setLoadingStep('Synthesizing cognitive avatar...');
        await new Promise(resolve => setTimeout(resolve, 600));
        const avatarUrl = await generateAvatar(name, finalBio);
        
        onComplete({ 
          name, 
          bio: finalBio, 
          links: links, 
          source: mode,
          avatarUrl: avatarUrl
        });
    } catch (err) {
        onComplete({ name, bio, links: links, source: mode });
    } finally {
        setIsAnalyzing(false);
        setLoadingStep('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full p-8 md:p-14 glass-panel rounded-[3.5rem] border-t border-cyan-900 shadow-2xl animate-fade-in-up">
      <div className="mb-10 md:mb-14 text-center">
        <div className="inline-block p-5 md:p-6 rounded-[2rem] bg-cyan-950/30 mb-8 border border-cyan-800 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
             <svg className="w-12 h-12 md:w-16 md:h-16 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-500 mb-6 tracking-tighter uppercase leading-tight">
          Initialize Perception
        </h2>
        <p className="text-neutral-400 max-w-md mx-auto text-sm md:text-base leading-relaxed font-light opacity-80">
            Construct a high-fidelity digital consciousness link to replicate unique ideological perspectives.
        </p>
      </div>

      <div className="flex gap-3 md:gap-5 mb-12 justify-center">
        <button
          onClick={() => setMode('manual')}
          className={`px-8 md:px-10 py-4 rounded-2xl text-[11px] font-mono uppercase tracking-[0.3em] transition-all active:scale-95 ${
            mode === 'manual' 
              ? 'bg-cyan-500 text-black font-bold shadow-xl shadow-cyan-500/30' 
              : 'text-neutral-600 hover:text-neutral-300 bg-white/5 border border-white/5'
          }`}
        >
          [ Manual ]
        </button>
        <button
          onClick={() => setMode('search')}
          className={`px-8 md:px-10 py-4 rounded-2xl text-[11px] font-mono uppercase tracking-[0.3em] transition-all active:scale-95 ${
            mode === 'search' 
              ? 'bg-purple-600 text-white font-bold shadow-xl shadow-purple-500/30 border border-purple-500/50' 
              : 'text-neutral-600 hover:text-neutral-300 bg-white/5 border border-white/5'
          }`}
        >
          [ Search ]
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="group">
          <label className="block text-[10px] uppercase tracking-[0.4em] text-neutral-600 mb-4 font-mono font-bold ml-2">Subject_Identity</label>
          <div className="flex flex-col sm:flex-row gap-5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-neutral-800 rounded-3xl px-7 py-5 text-white focus:outline-none focus:border-cyan-500 transition-all placeholder-neutral-800 text-base font-normal shadow-inner"
              placeholder={mode === 'manual' ? "Target Identity Name" : "e.g. Socrates, Elon Musk"}
            />
            {mode === 'search' && (
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !name}
                className="bg-white text-black hover:bg-cyan-400 disabled:opacity-20 px-10 py-5 rounded-3xl font-bold transition-all text-[11px] uppercase tracking-widest active:scale-95 shadow-2xl shrink-0"
              >
                {isSearching ? '...' : 'Fetch Trace'}
              </button>
            )}
          </div>
        </div>

        <div className="group">
          <label className="block text-[10px] uppercase tracking-[0.4em] text-neutral-600 mb-4 font-mono font-bold ml-2">
            Ideological_Grounding
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full h-44 bg-black/40 border border-neutral-800 rounded-[2rem] px-8 py-6 text-white focus:outline-none focus:border-cyan-500 transition-all resize-none text-base leading-relaxed font-light placeholder-neutral-800 shadow-inner"
            placeholder={mode === 'search' ? "Fetch profile to auto-populate worldview..." : "Describe the core tenets of this person's perspective..."}
            readOnly={mode === 'search' && isSearching}
          />
        </div>

        <div className="group">
          <label className="block text-[10px] uppercase tracking-[0.4em] text-neutral-600 mb-4 font-mono font-bold ml-2">
            Digital_Streams
          </label>
          <input
            type="text"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            className="w-full bg-black/40 border border-neutral-800 rounded-2xl px-7 py-5 text-white focus:outline-none focus:border-cyan-500 transition-all text-sm font-light placeholder-neutral-800 shadow-inner"
            placeholder="Links or reference fragments"
          />
        </div>

        {error && <div className="p-5 bg-red-900/10 border border-red-900/40 rounded-3xl text-red-500 text-[11px] font-mono animate-pulse text-center">{error}</div>}

        <button
          type="submit"
          disabled={!bio || !name || isAnalyzing}
          className="w-full bg-gradient-to-br from-cyan-600 to-purple-700 hover:from-cyan-500 hover:to-purple-600 disabled:opacity-10 text-white py-6 rounded-[2.5rem] font-bold text-xs tracking-[0.4em] uppercase transition-all shadow-[0_0_50px_rgba(34,211,238,0.2)] active:scale-[0.98] flex items-center justify-center gap-5 group"
        >
          {isAnalyzing ? (
             <span className="flex items-center gap-4">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                {loadingStep}
             </span>
          ) : (
            <>
                <span>Establish Consciousness Link</span>
                <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
