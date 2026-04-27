import { cn } from '../lib/utils';
import { RecommendationResponse } from '../types';

interface HeaderProps {
  data: RecommendationResponse | null;
  riskMode: 'safe' | 'aggressive';
  setRiskMode: (mode: 'safe' | 'aggressive') => void;
}

export const Header = ({ data, riskMode, setRiskMode }: HeaderProps) => {
  return (
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
          <span className="text-xl font-bold text-fpl-green tabular-nums">+{(data?.expectedPoints || 0).toFixed(1)} xP</span>
        </div>
      </div>
    </header>
  );
};
