import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, Award, Clock } from 'lucide-react';

interface PerformanceViewProps {
  history: any;
  fetchLivePoints: (gwId: number) => Promise<any>;
}

export const PerformanceView = ({ history, fetchLivePoints }: PerformanceViewProps) => {
  const [actualScores, setActualScores] = useState<Record<number, Record<number, number>>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const gws = Object.keys(history).map(Number).sort((a, b) => b - a);

  const calculateActual = (gwId: number, snapshot: any) => {
    if (!actualScores[gwId]) return 0;
    let total = 0;
    
    // Support both old 'ids' format and new 'players' metadata format
    const playerIds = snapshot.players ? snapshot.players.map((p: any) => p.id) : (snapshot.ids || []);
    const captainId = snapshot.captainId;

    playerIds.forEach((id: number) => {
      const pData = actualScores[gwId][id];
      if (pData !== undefined) {
        total += pData;
        if (id === captainId) total += pData; // Captain gets double
      }
    });
    return total;
  };

  const refreshActuals = async (gwId: number) => {
    setLoading(prev => ({ ...prev, [gwId]: true }));
    const elements = await fetchLivePoints(gwId);
    if (elements) {
      const scores: Record<number, number> = {};
      elements.forEach((el: any) => {
        scores[el.id] = el.stats.total_points;
      });
      setActualScores(prev => ({ ...prev, [gwId]: scores }));
    }
    setLoading(prev => ({ ...prev, [gwId]: false }));
  };

  if (gws.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">No history snapshots yet.</p>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[250px]">
          Snapshots are taken when you use the <span className="text-fpl-green font-bold">SNAPSHOT</span> button in the Pitch view. 
          Use it before the deadline to lock in your final recommendations!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
      {gws.map(gwId => {
        const modes = history[gwId];
        return (
          <div key={gwId} className="bg-slate-950/40 border border-fpl-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-fpl-green" />
                GAMEWEEK {gwId} PERFORMANCE
              </h3>
              <button 
                onClick={() => refreshActuals(gwId)}
                disabled={loading[gwId]}
                className="text-[9px] font-black uppercase tracking-widest bg-fpl-purple px-3 py-1 rounded-lg hover:bg-fpl-purple/80 transition-colors disabled:opacity-50"
              >
                {loading[gwId] ? 'FETCHING...' : 'REFRESH ACTUALS'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {(['safe', 'aggressive', 'value'] as const).map(mode => {
                const data = modes[mode];
                if (!data) return null;
                
                const normalizedXP = (data.xP || 0) / 15;
                const actual = calculateActual(gwId, data);
                const diff = actual - normalizedXP;
                const hasStarted = actual > 0;
                const isExpanded = expandedMode === `${gwId}-${mode}`;

                return (
                  <div key={mode} className="bg-card-bg border border-fpl-border rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        mode === 'aggressive' ? "text-orange-400" : 
                        mode === 'value' ? "text-cyan-400" : 
                        "text-fpl-green"
                      )}>{mode}</p>
                      
                      <button 
                        onClick={() => toggleExpand(gwId, mode)}
                        className="text-[8px] text-slate-500 hover:text-white uppercase font-bold tracking-tighter"
                      >
                        {isExpanded ? '[ HIDE SQUAD ]' : '[ VIEW SQUAD ]'}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase font-medium">Expected</p>
                        <p className="text-lg font-black text-white">{normalizedXP.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">xP</span></p>
                      </div>
                      
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase font-medium">Actual Result</p>
                        <p className="text-lg font-black text-white">
                          {actualScores[gwId] ? actual.toFixed(0) : '--'}
                          <span className="text-[10px] font-normal text-slate-500 ml-1">pts</span>
                        </p>
                      </div>

                      <div className="flex flex-col justify-center">
                        {hasStarted ? (
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] font-black",
                            diff >= 0 ? "text-fpl-green" : "text-fpl-pink"
                          )}>
                            <TrendingUp className={cn("w-3 h-3", diff < 0 && "rotate-180")} />
                            {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} vs xP
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-600 font-mono uppercase tracking-tighter">
                            {data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'No Time'}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && data.players && (
                      <div className="mt-4 pt-4 border-t border-fpl-border grid grid-cols-2 gap-x-6 gap-y-2">
                        {data.players.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-slate-600 w-6 font-bold">{p.position}</span>
                              <span className={cn(
                                "text-[10px] font-bold",
                                p.id === data.captainId ? "text-fpl-green" : "text-slate-300"
                              )}>
                                {p.web_name} {p.id === data.captainId && '(C)'}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-500">
                              {actualScores[gwId]?.[p.id] !== undefined ? `${actualScores[gwId][p.id]}${p.id === data.captainId ? 'x2' : ''} pts` : '--'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
