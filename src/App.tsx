import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

import { useFPLData } from './hooks/useFPLData';
import { Header } from './components/Header';
import { MetricsColumn } from './components/MetricsColumn';
import { PitchView } from './components/PitchView';
import { DataGrid } from './components/DataGrid';
import { TransferView } from './components/TransferView';
import { ChipAdvisor } from './components/ChipAdvisor';
import { FixtureList } from './components/FixtureList';
import { cn } from './lib/utils';

export default function App() {
  const [riskMode, setRiskMode] = useState<'safe' | 'aggressive'>('safe');
  const [tab, setTab] = useState<'pitch' | 'picks' | 'transfers' | 'chips'>('pitch');
  
  const { 
    data, 
    loading, 
    teamId, 
    setTeamId, 
    syncedData, 
    syncing, 
    syncTeam, 
    formation 
  } = useFPLData(riskMode);

  const handleSync = async () => {
    const success = await syncTeam();
    if (success) setTab('transfers');
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-fpl-green animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Optimizing Strategy...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] p-6 font-sans">
      <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-4 auto-rows-min">
        
        <Header data={data} riskMode={riskMode} setRiskMode={setRiskMode} />

        <MetricsColumn data={data} riskMode={riskMode} />

        {/* Primary Content Area */}
        <div className="col-span-12 lg:col-span-6 bg-card-bg border border-fpl-border rounded-3xl overflow-hidden relative shadow-xl min-h-[600px]">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px)` }}></div>
          
          <div className="relative z-10 p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-fpl-border">
                {(['pitch', 'picks', 'transfers', 'chips'] as const).map((t) => (
                  <button 
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      tab === t ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >{t}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="TEAM ID" 
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="bg-slate-950 border border-fpl-border rounded-lg px-3 py-1 text-[10px] font-mono text-fpl-green w-24 focus:outline-none focus:border-fpl-green"
                />
                <button 
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-fpl-purple hover:bg-fpl-purple/80 disabled:opacity-50 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-colors"
                >
                  {syncing ? 'SYNCING...' : 'SYNC TEAM'}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'pitch' ? (
                <PitchView data={data} formation={formation} />
              ) : tab === 'picks' ? (
                <DataGrid data={data} />
              ) : tab === 'transfers' ? (
                <TransferView syncedData={syncedData} />
              ) : (
                <ChipAdvisor syncedData={syncedData} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4">
           {/* Top Value Picks Card */}
           <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 flex flex-col shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Top Value Picks (PPM)</h2>
            <div className="space-y-3 flex-grow">
               {data?.topPicks?.mid?.slice(0, 5).map((p, i) => (
                <div key={p.id} className={cn("flex items-center justify-between border-b border-fpl-border pb-2", i >= 4 && "border-0")}>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{p.web_name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{p.position} | £{((p?.now_cost || 0)/10).toFixed(1)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-fpl-green">{(p?.ppm || 0).toFixed(2)}</span>
                    <div className="text-[8px] text-slate-500 uppercase font-bold">Pts/£M</div>
                  </div>
                </div>
               ))}
            </div>
          </div>
          
          <FixtureList data={data} />
        </div>
      </div>
    </div>
  );
}
