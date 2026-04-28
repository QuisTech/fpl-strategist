import { cn } from '../lib/utils';
import { ScoredPlayer } from '../types';

interface PlayerCardProps {
  player: ScoredPlayer;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  compact?: boolean;
  key?: number | string;
}

export const PlayerCard = ({ 
  player, 
  isCaptain, 
  isViceCaptain, 
  compact = false 
}: PlayerCardProps) => {
  if (!player) return null;
  
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
