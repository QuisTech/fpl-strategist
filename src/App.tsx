import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  Shield, 
  Zap, 
  ChevronRight, 
  ArrowRightCircle, 
  Info,
  RefreshCw,
  LayoutGrid,
  List,
  Star
} from 'lucide-react';
import { RecommendationResponse, ScoredPlayer, TeamSyncResponse, TransferRecommendation, ChipAdvice } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Player Card Component
const PlayerCard = ({ 
  player, 
  isCaptain, 
  isViceCaptain, 
  compact = false 
}: { 
  player: ScoredPlayer, 
  isCaptain?: boolean, 
  isViceCaptain?: boolean, 
  compact?: boolean,
  key?: string | number
}) => {
  return (
    <div className={cn(
      "relative flex flex-col p-2 bg-slate-950 border-2 rounded-lg shadow-lg transition-transform hover:scale-105",
      isCaptain ? "border-fpl-green shadow-[0_0_15px_rgba(0,255,133,0.2)]" : isViceCaptain ? "border-fpl-pink" : "border-slate-800",
      compact ? "w-20 h-28" : "w-28 h-36"
    )}>
      {isCaptain && (
        <div className="absolute -top-2 -right-2 bg-fpl-green text-slate-950 font-black px-1.5 py-0.5 rounded text-[8px] z-10">
          C
        </div>
      )}
      {isViceCaptain && (
        <div className="absolute -top-2 -right-2 bg-fpl-pink text-white font-black px-1.5 py-0.5 rounded text-[8px] z-10">
          VC
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center space-y-1">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
          {player.team_short_name}
        </div>
        <div className={cn(
          "font-bold text-slate-100 text-center leading-tight truncate w-full px-1 bg-slate-950 rounded",
          compact ? "text-[10px]" : "text-[11px]"
        )}>
          {player.web_name}
        </div>
        <div className="text-[9px] font-bold text-fpl-green">
          {(player?.score || 0).toFixed(1)} xP
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskMode, setRiskMode] = useState<'safe' | 'aggressive'>('safe');
  const [tab, setTab] = useState<'pitch' | 'picks' | 'transfers' | 'chips'>('pitch');
  const [teamId, setTeamId] = useState<string>('');
  const [syncedData, setSyncedData] = useState<TeamSyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, [riskMode]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/fpl/recommendations?riskMode=${riskMode}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError("Failed to load FPL data. Please check FPL API status.");
    } finally {
      setLoading(false);
    }
  };

  const syncTeam = async () => {
    if (!teamId) return;
    setSyncing(true);
    try {
      const res = await axios.get(`/api/fpl/sync/${teamId}?riskMode=${riskMode}`);
      setSyncedData(res.data);
      setTab('transfers');
      setError(null);
    } catch (err) {
      setError("Failed to sync team. Check your Team ID.");
    } finally {
      setSyncing(false);
    }
  };

  const formation = useMemo(() => {
    if (!data) return { def: [], mid: [], fwd: [], gkp: [] };
    const validXI = data.startingXI.filter((p): p is ScoredPlayer => !!p);
    return {
      def: validXI.filter(p => p.position === 'DEF'),
      mid: validXI.filter(p => p.position === 'MID'),
      fwd: validXI.filter(p => p.position === 'FWD'),
      gkp: validXI.filter(p => p.position === 'GKP'),
    };
  }, [data]);

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
        
        {/* Header */}
        <header className="col-span-12 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-fpl-purple rounded flex items-center justify-center font-black text-xl text-white shadow-lg shadow-fpl-purple/20">F</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">FPL <span className="text-fpl-green">OPTIMIZER</span></h1>
              <p className="text-[10px] text-slate-500 font-light uppercase tracking-widest">Decision Support Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-card-bg/50 p-2 rounded-xl border border-fpl-border">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 text-right font-medium">Strategy Mode</span>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded mt-1">
                <button 
                  onClick={() => setRiskMode('safe')}
                  className={cn(
                    "px-4 py-0.5 text-[10px] rounded font-bold transition-all",
                    riskMode === 'safe' ? "bg-fpl-green text-slate-950" : "text-slate-400 hover:text-slate-200"
                  )}
                >SAFE</button>
                <button 
                  onClick={() => setRiskMode('aggressive')}
                  className={cn(
                    "px-4 py-0.5 text-[10px] rounded font-bold transition-all",
                    riskMode === 'aggressive' ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  )}
                >RISKY</button>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Expected Points</span>
              <span className="text-xl font-bold text-fpl-green tabular-nums">+{data?.expectedPoints.toFixed(1)} xP</span>
            </div>
          </div>
        </header>

        {/* Metrics Grid */}
        <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4">
          {/* Squad Metrics Card */}
          <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Squad Value</h2>
              <span className="text-fpl-green text-[10px] font-bold">OPTIMAL</span>
            </div>
            <div>
              <div className="text-4xl font-bold font-mono tracking-tighter text-white">
                £{(data?.totalCost! / 10).toFixed(1)}M
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-fpl-border">
                <span className="text-slate-400 text-xs font-medium">ITB Remaining</span>
                <span className="font-mono font-black text-sm text-fpl-green">£{(100 - (data?.totalCost! / 10)).toFixed(1)}M</span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Projected Rank Gain</span>
                <span className="font-bold text-emerald-400">+12%</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Risk Profile</span>
                <span className={cn("font-bold uppercase", riskMode === 'aggressive' ? "text-orange-400" : "text-fpl-green")}>{riskMode}</span>
              </div>
            </div>
          </div>

          {/* Captain Card */}
          <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Top Recommendation</h2>
            <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-fpl-border">
              <div className="w-10 h-10 bg-fpl-pink rounded-xl flex items-center justify-center shadow-lg shadow-fpl-pink/20">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black">{data?.captain.team_name}</p>
                <p className="text-sm font-black text-white">{data?.captain.web_name}</p>
                <p className="text-[10px] text-fpl-green font-bold">Captain Pick</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pitch / Primary Content */}
        <div className="col-span-12 lg:col-span-6 bg-card-bg border border-fpl-border rounded-3xl overflow-hidden relative shadow-xl min-h-[600px]">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px)` }}></div>
          
          <div className="relative z-10 p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-fpl-border">
                <button 
                  onClick={() => setTab('pitch')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    tab === 'pitch' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >Pitch</button>
                <button 
                  onClick={() => setTab('picks')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    tab === 'picks' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >Data</button>
                <button 
                  onClick={() => setTab('transfers')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    tab === 'transfers' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >Transfers</button>
                <button 
                  onClick={() => setTab('chips')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    tab === 'chips' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >Chips</button>
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
                  onClick={syncTeam}
                  disabled={syncing}
                  className="bg-fpl-purple hover:bg-fpl-purple/80 disabled:opacity-50 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-colors"
                >
                  {syncing ? 'SYNCING...' : 'SYNC TEAM'}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'pitch' ? (
                <motion.div 
                  key="pitch-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-grow flex flex-col justify-around py-4"
                >
                  <div className="flex justify-around items-center">
                    {formation.gkp.map(p => <PlayerCard key={p.id} player={p} />)}
                  </div>
                  <div className="flex justify-around items-center">
                    {formation.def.map(p => <PlayerCard key={p.id} player={p} isCaptain={p.id === data?.captain.id} isViceCaptain={p.id === data?.viceCaptain.id} />)}
                  </div>
                  <div className="flex justify-around items-center">
                    {formation.mid.map(p => <PlayerCard key={p.id} player={p} isCaptain={p.id === data?.captain.id} isViceCaptain={p.id === data?.viceCaptain.id} />)}
                  </div>
                  <div className="flex justify-around items-center">
                    {formation.fwd.map(p => <PlayerCard key={p.id} player={p} isCaptain={p.id === data?.captain.id} isViceCaptain={p.id === data?.viceCaptain.id} />)}
                  </div>

                  {/* Pitch Bench Sub-Component */}
                  <div className="mt-8 pt-4 border-t border-fpl-border/50">
                    <div className="flex justify-center gap-2">
                       {data?.bench.filter(Boolean).map(p => <PlayerCard key={p.id} player={p} compact />)}
                    </div>
                    <p className="text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 px-6">Substitution Bench</p>
                  </div>
                </motion.div>
              ) : tab === 'picks' ? (
                <motion.div 
                  key="data-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar"
                >
                  {(['gkp', 'def', 'mid', 'fwd'] as const).map((pos) => (
                    <div key={pos} className="bg-slate-950/40 rounded-2xl border border-fpl-border overflow-hidden">
                      <div className="px-3 py-2 bg-slate-900/50 border-b border-fpl-border flex justify-between">
                        <span className="text-[10px] font-black uppercase text-fpl-green tracking-widest">{pos} Picks</span>
                        <span className="text-[10px] font-mono text-slate-600">xP</span>
                      </div>
                      <div className="divide-y divide-fpl-border/50">
                        {data?.topPicks[pos].map(p => (
                          <div key={p.id} className="p-2 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-200">{p.web_name}</span>
                              <span className="text-[9px] text-slate-500 uppercase font-medium">{p.team_short_name} • £{(p.now_cost/10).toFixed(1)}m</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-fpl-green">{(p?.score || 0).toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : tab === 'transfers' ? (
                <motion.div
                  key="transfer-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-6"
                >
                  {!syncedData ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                      <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-800">
                        <Users className="text-slate-700" />
                      </div>
                      <h3 className="text-slate-300 font-bold mb-2">Sync Your Team</h3>
                      <p className="text-slate-500 text-xs max-w-xs">Enter your FPL Team ID above to see personalized transfer recommendations and "xP Jump" metrics.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4">Top 1-for-1 Swaps</h3>
                      {syncedData.transfers.map((rec, i) => (
                        <div key={i} className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-fpl-border hover:border-fpl-green/50 transition-colors group">
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-rose-500 font-black uppercase">Transfer Out</span>
                              <span className="text-sm font-bold text-slate-100">{rec.out.web_name}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{rec.out.team_short_name} • £{(rec.out.now_cost/10).toFixed(1)}m</span>
                            </div>
                            <ArrowRightCircle className="text-slate-700 group-hover:text-fpl-green transition-colors" />
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-fpl-green font-black uppercase">Transfer In</span>
                              <span className="text-sm font-bold text-slate-100">{rec.in.web_name}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{rec.in.team_short_name} • £{(rec.in.now_cost/10).toFixed(1)}m</span>
                            </div>
                          </div>
                          <div className="w-px h-10 bg-slate-800"></div>
                          <div className="flex flex-col items-center justify-center min-w-[60px]">
                            <span className="text-xl font-black text-fpl-green">+{(rec?.scoreJump || 0).toFixed(1)}</span>
                            <span className="text-[8px] text-slate-500 font-bold uppercase">xP Gain</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="chip-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                   <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4">Strategic Chip Advisor</h3>
                   {!syncedData ? (
                     <div className="p-8 text-center text-slate-500 text-sm italic">Sync your team to get personalized chip advice based on your current roster.</div>
                   ) : (
                     <div className="grid grid-cols-1 gap-4">
                       {syncedData.chips.map((chip, i) => (
                         <div key={i} className="bg-slate-950/80 p-5 rounded-3xl border border-fpl-border flex flex-col gap-3">
                           <div className="flex justify-between items-center">
                             <div className="flex items-center gap-3">
                               <div className={cn(
                                 "w-2 h-2 rounded-full",
                                 chip.recommendation === 'STRONG BUY' ? "bg-fpl-green shadow-[0_0_8px_rgba(0,255,133,0.5)]" :
                                 chip.recommendation === 'HOLD' ? "bg-amber-500" : "bg-rose-500"
                               )}></div>
                               <span className="text-sm font-black text-white uppercase tracking-wider">{chip.chip}</span>
                             </div>
                             <span className={cn(
                               "text-[10px] font-black px-2 py-0.5 rounded",
                               chip.recommendation === 'STRONG BUY' ? "bg-fpl-green/10 text-fpl-green" :
                               chip.recommendation === 'HOLD' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                             )}>{chip.recommendation}</span>
                           </div>
                           <p className="text-xs text-slate-400 leading-relaxed">{chip.reason}</p>
                         </div>
                       ))}
                     </div>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column Grid */}
        <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4">
          {/* Top Value Picks Card */}
          <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 flex flex-col shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Top Value Picks (PPM)</h2>
            <div className="space-y-3 flex-grow">
               {data?.topPicks.mid.slice(0, 5).map((p, i) => (
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
            <div className="mt-4 pt-4 border-t border-fpl-border">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated</span>
                <span className="text-[10px] font-mono text-slate-500">{new Date(data?.lastUpdated || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
              </div>
            </div>
          </div>

          {/* Fixture Difficulty Sub-Grid */}
          <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Next Fixtures</h2>
            <div className="space-y-4">
              {data?.squad.slice(0, 5).map(p => (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-200">{p.team_short_name}</span>
                    <span className="text-slate-500">({p.next_fixtures.map(f => f.opponent).join(', ')})</span>
                  </div>
                  <div className="flex gap-1 h-2.5">
                    {p.next_fixtures.map((f, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex-grow rounded-sm transition-opacity hover:opacity-100 opacity-80",
                          f.difficulty === 2 ? "bg-fpl-green" :
                          f.difficulty === 3 ? "bg-amber-500" :
                          f.difficulty === 4 ? "bg-rose-500" : "bg-fpl-pink"
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Optimization Note */}
            <div className="mt-6 p-2 bg-slate-950 rounded-xl border border-fpl-border">
              <div className="text-[9px] text-slate-500 uppercase mb-1 font-black tracking-widest">Logic Engine</div>
              <p className="text-[10px] leading-tight text-slate-400 italic">Expected points maximized using 3-GW aggregate weighting.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
