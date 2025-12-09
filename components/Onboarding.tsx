import React, { useState } from 'react';
import { UserProfile, GroundingSource } from '../types';
import { searchUserBio, analyzeIdentity } from '../services/geminiService';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'input' | 'search'>('input');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!name.trim()) return;
    setIsSearching(true);
    setError(null);
    setBio('');
    
    try {
      const result = await searchUserBio(name);
      setBio(result.bio);
      setSources(result.sources);
      if (result.bio.includes("No bio found")) {
         setError("Could not find sufficient information. Please enter bio manually.");
      }
    } catch (e) {
      setError("Failed to connect to consciousness grid (Search API Error).");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bio) return;
    
    setIsAnalyzing(true);
    try {
        // We now "Analyze" by merging the links into the bio to create a final bio
        const finalBio = await analyzeIdentity(name, bio, links);
        onComplete({ name, bio: finalBio, links: links, source: mode });
    } catch (err) {
        console.error("Analysis failed", err);
        // Fallback to existing bio if analysis fails
        onComplete({ name, bio, links: links, source: mode });
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-8 glass-panel rounded-2xl border-t border-cyan-900 shadow-2xl animate-fade-in-up">
      <div className="mb-8 text-center">
        <div className="inline-block p-3 rounded-full bg-cyan-950/50 mb-4 border border-cyan-800">
             <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </div>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
          Create Digital Twin
        </h2>
        <p className="text-gray-400 max-w-md mx-auto">
            Initialize an AI clone of yourself (or another) to engage in deep ideation and dialectic conversation.
        </p>
      </div>

      <div className="flex gap-4 mb-6 justify-center">
        <button
          onClick={() => setMode('input')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'input' 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          My Bio
        </button>
        <button
          onClick={() => setMode('search')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'search' 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Search Public Figure
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Identity Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder={mode === 'input' ? "Your Name" : "e.g. Elon Musk, Plato"}
            />
            {mode === 'search' && (
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !name}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-6 rounded-lg font-medium transition-colors"
              >
                {isSearching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </span>
                ) : 'Search'}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
            Biography
            {mode === 'search' && <span className="ml-2 text-purple-400 text-[10px]">(Auto-Generated)</span>}
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full h-32 bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none text-sm leading-relaxed"
            placeholder={mode === 'search' ? "Search for a name to auto-fill..." : "Paste your bio, manifesto, or a description. The more detailed, the better the clone."}
            readOnly={mode === 'search' && isSearching}
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
            Reference Links / Socials (Optional)
          </label>
          <input
            type="text"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
            placeholder="e.g. linkedin.com/in/you, yourblog.com, twitter.com/handle"
          />
          <p className="text-[10px] text-gray-500 mt-1">We will scan these to extract factual details and expertise.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {sources.length > 0 && (
          <div className="bg-black/30 p-4 rounded-lg border border-gray-800">
             <h4 className="text-xs uppercase text-gray-500 mb-2">Memory Sources</h4>
             <ul className="space-y-1">
               {sources.slice(0, 3).map((s, i) => (
                 <li key={i}>
                   <a href={s.uri} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline truncate block">
                     {s.title}
                   </a>
                 </li>
               ))}
             </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={!bio || !name || isAnalyzing}
          className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg tracking-wide uppercase transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-3"
        >
          {isAnalyzing ? (
             <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Refining Biography with Links...
             </span>
          ) : (
            <>
                <span>Initialize Consciousness</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
};