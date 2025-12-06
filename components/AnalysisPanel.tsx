import React from 'react';
import { AnalysisResult, SafetyLevel } from '../types';
import { AlertTriangle, ShieldCheck, ShieldAlert, Ban, Activity, MapPin } from 'lucide-react';

interface AnalysisPanelProps {
  result: AnalysisResult | null;
  loading: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4 p-6 bg-[#0a0a0f] text-hud-cyan">
        <div className="relative">
          <Activity className="w-16 h-16 animate-spin text-hud-cyan opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-hud-cyan rounded-full animate-ping"></div>
          </div>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm tracking-[0.2em] text-hud-cyan animate-pulse">PROCESSING</p>
          <p className="text-[10px] text-gray-500 font-mono mt-1">OBJECT DETECTION IN PROGRESS</p>
        </div>
        <div className="w-48 bg-gray-800 h-0.5 mt-6 overflow-hidden">
          <div className="bg-hud-cyan h-full w-1/3 animate-[shimmer_1s_infinite_linear]"></div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[#0a0a0f] text-gray-500">
        <div className="border border-dashed border-gray-800 rounded-lg p-8 text-center max-w-xs">
          <div className="w-12 h-12 border-2 border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
             <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
          <p className="font-mono text-sm text-gray-400">NO TELEMETRY DATA</p>
          <p className="text-xs mt-2 text-gray-600">
            Initiate visual scanning sequence to detect road conditions.
          </p>
        </div>
      </div>
    );
  }

  const getSafetyColor = (level: SafetyLevel) => {
    switch (level) {
      case SafetyLevel.SAFE: return 'text-hud-green border-hud-green shadow-[0_0_15px_rgba(0,255,157,0.2)]';
      case SafetyLevel.CAUTION: return 'text-hud-amber border-hud-amber shadow-[0_0_15px_rgba(255,174,0,0.2)]';
      case SafetyLevel.DANGER: return 'text-hud-red border-hud-red shadow-[0_0_15px_rgba(255,42,42,0.2)]';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  const SafetyIcon = {
    [SafetyLevel.SAFE]: ShieldCheck,
    [SafetyLevel.CAUTION]: ShieldAlert,
    [SafetyLevel.DANGER]: AlertTriangle
  }[result.safetyLevel];

  return (
    <div className="h-full w-full flex flex-col bg-[#0a0a0f] overflow-y-auto custom-scrollbar">
      
      {/* Top Status Bar */}
      <div className={`p-6 border-b border-gray-800 ${getSafetyColor(result.safetyLevel)} bg-gradient-to-r from-gray-900/50 to-transparent`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest opacity-70">Safety Assessment</h2>
          <span className="font-mono text-[10px] text-gray-400">{result.timestamp}</span>
        </div>
        <div className="flex items-center space-x-4">
            <SafetyIcon className="w-10 h-10" />
            <span className="text-3xl font-bold font-mono tracking-tighter">{result.safetyLevel}</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* Recommendation Box */}
        <div className="relative">
          <div className="absolute -left-6 top-0 bottom-0 w-1 bg-hud-cyan"></div>
          <h3 className="text-hud-cyan text-[10px] font-mono mb-2 uppercase tracking-widest">System Recommendation</h3>
          <p className="text-sm font-medium leading-relaxed text-gray-200">{result.recommendation}</p>
        </div>

        {/* Hazards Section */}
        <div>
          <h3 className="text-hud-red text-[10px] font-mono mb-4 uppercase tracking-widest flex items-center">
            <AlertTriangle className="w-3 h-3 mr-2" />
            Detected Hazards <span className="ml-2 bg-hud-red/20 text-hud-red px-1.5 py-0.5 rounded text-[10px]">{result.hazards.length}</span>
          </h3>
          <div className="space-y-3">
            {result.hazards.length === 0 ? (
               <div className="p-4 border border-gray-800 rounded bg-gray-900/30 text-center">
                  <p className="text-gray-500 text-xs italic">No immediate hazards detected.</p>
               </div>
            ) : (
                result.hazards.map((hazard, idx) => (
                    <div key={idx} className="bg-red-950/10 border border-red-900/30 p-3 rounded-sm group hover:bg-red-950/20 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm text-red-200 font-mono">{hazard.type}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                hazard.severity === 'HIGH' ? 'bg-red-600 text-white' : 
                                hazard.severity === 'MEDIUM' ? 'bg-orange-600 text-white' : 
                                'bg-yellow-600 text-black'
                            }`}>{hazard.severity}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-snug">{hazard.description}</p>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Road Signs Section */}
        <div>
           <h3 className="text-hud-cyan text-[10px] font-mono mb-4 uppercase tracking-widest flex items-center">
            <Ban className="w-3 h-3 mr-2" />
            Signage Analysis <span className="ml-2 bg-hud-cyan/20 text-hud-cyan px-1.5 py-0.5 rounded text-[10px]">{result.signs.length}</span>
          </h3>
           <div className="grid grid-cols-1 gap-3">
            {result.signs.length === 0 ? (
                <div className="p-4 border border-gray-800 rounded bg-gray-900/30 text-center">
                    <p className="text-gray-500 text-xs italic">No traffic signs identified.</p>
                </div>
            ) : (
                result.signs.map((sign, idx) => (
                    <div key={idx} className="bg-cyan-950/10 border border-cyan-900/30 p-3 flex items-start justify-between rounded-sm group hover:bg-cyan-950/20 transition-colors">
                         <div className="flex-1 mr-4">
                            <div className="font-bold text-sm text-cyan-100 font-mono mb-1">{sign.type}</div>
                            <div className="text-xs text-cyan-400/70 leading-snug">{sign.meaning}</div>
                         </div>
                         <div className="flex items-center text-[9px] font-mono bg-cyan-950/50 border border-cyan-900/50 px-2 py-1 text-cyan-300 rounded whitespace-nowrap">
                            <MapPin className="w-2 h-2 mr-1" />
                            {sign.location}
                         </div>
                    </div>
                ))
            )}
           </div>
        </div>
        
        {/* Footer info */}
        <div className="pt-4 border-t border-gray-800 text-[10px] font-mono text-gray-600 text-center uppercase">
          AI Vision v2.5 • Latency 12ms
        </div>

      </div>
    </div>
  );
};

export default AnalysisPanel;