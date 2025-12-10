import React from 'react';
import { AutomationSuggestion } from '../types';
import { ICONS } from '../constants';

interface AutomationCardProps {
  suggestion: AutomationSuggestion;
  onClick: (suggestion: AutomationSuggestion) => void;
}

const AutomationCard: React.FC<AutomationCardProps> = ({ suggestion, onClick }) => {
  return (
    <div 
      onClick={() => onClick(suggestion)}
      className="group relative overflow-hidden bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transform hover:-translate-y-1"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg text-slate-100 group-hover:text-cyan-400 transition-colors">
          {suggestion.title}
        </h3>
        <div className="bg-slate-900/80 rounded-full px-2 py-1 text-xs font-mono text-cyan-400 border border-cyan-900 flex items-center gap-1">
          <ICONS.Sparkles className="w-3 h-3" />
          {suggestion.relevanceScore}% Match
        </div>
      </div>
      
      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
        {suggestion.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {suggestion.tools.map((tool, idx) => (
          <span key={idx} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
            {tool}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-700/50">
        <div className="flex items-center text-emerald-400 gap-1.5">
          <ICONS.Clock className="w-4 h-4" />
          <span>{suggestion.estimatedTimeSavings}</span>
        </div>
        <div className="flex items-center text-cyan-500 group-hover:translate-x-1 transition-transform">
          <span className="mr-1">View Guide</span>
          <ICONS.ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default AutomationCard;