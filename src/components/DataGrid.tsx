import { motion } from 'motion/react';
import { RecommendationResponse } from '../types';

interface DataGridProps {
  data: RecommendationResponse | null;
}

export const DataGrid = ({ data }: DataGridProps) => {
  return (
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
            {data?.topPicks[pos]?.map(p => (
              <div key={p.id} className="p-2 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">{p.web_name}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-medium">{p.team_short_name} • £{((p?.now_cost || 0)/10).toFixed(1)}m</span>
                </div>
                <span className="text-xs font-mono font-bold text-fpl-green">{(p?.score || 0).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};
