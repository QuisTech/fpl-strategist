import { motion } from 'motion/react';
import { Users, ArrowRightCircle } from 'lucide-react';
import { TeamSyncResponse } from '../types';

interface TransferViewProps {
  syncedData: TeamSyncResponse | null;
}

export const TransferView = ({ syncedData }: TransferViewProps) => {
  if (!syncedData) {
    return (
      <motion.div
        key="transfer-empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center h-full py-20 text-center"
      >
        <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-800">
          <Users className="text-slate-700" />
        </div>
        <h3 className="text-slate-300 font-bold mb-2">Sync Your Team</h3>
        <p className="text-slate-500 text-xs max-w-xs">Enter your FPL Team ID above to see personalized transfer recommendations and "xP Jump" metrics.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="transfer-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4">Top 1-for-1 Swaps</h3>
      {syncedData.transfers.map((rec, i) => (
        <div key={i} className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-fpl-border hover:border-fpl-green/50 transition-colors group">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-rose-500 font-black uppercase">Transfer Out</span>
              <span className="text-sm font-bold text-slate-100">{rec.out.web_name}</span>
              <span className="text-[10px] text-slate-500 uppercase">{rec.out.team_short_name} • £{((rec?.out?.now_cost || 0)/10).toFixed(1)}m</span>
            </div>
            <ArrowRightCircle className="text-slate-700 group-hover:text-fpl-green transition-colors" />
            <div className="flex flex-col text-right">
              <span className="text-[9px] text-fpl-green font-black uppercase">Transfer In</span>
              <span className="text-sm font-bold text-slate-100">{rec.in.web_name}</span>
              <span className="text-[10px] text-slate-500 uppercase">{rec.in.team_short_name} • £{((rec?.in?.now_cost || 0)/10).toFixed(1)}m</span>
            </div>
          </div>
          <div className="w-px h-10 bg-slate-800"></div>
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <span className="text-xl font-black text-fpl-green">+{(rec?.scoreJump || 0).toFixed(1)}</span>
            <span className="text-[8px] text-slate-500 font-bold uppercase">xP Gain</span>
          </div>
        </div>
      ))}
    </motion.div>
  );
};
