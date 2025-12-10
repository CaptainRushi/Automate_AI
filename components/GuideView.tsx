import React, { useState } from 'react';
import { DetailedGuide } from '../types';
import { ICONS } from '../constants';

interface GuideViewProps {
  guide: DetailedGuide;
  onBack: () => void;
}

const GuideView: React.FC<GuideViewProps> = ({ guide, onBack }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let text = `# ${guide.title}\n\n`;
    
    if (guide.prerequisites.length > 0) {
      text += `## Prerequisites\n`;
      guide.prerequisites.forEach(p => text += `- ${p}\n`);
      text += `\n`;
    }

    text += `## Steps\n`;
    guide.steps.forEach(step => {
      text += `${step.stepNumber}. ${step.instruction}\n`;
      if (step.selectorDescription) {
        text += `   > Visual: ${step.selectorDescription}\n`;
      }
      if (step.codeSnippet) {
        text += `   \`\`\`\n${step.codeSnippet}\n   \`\`\`\n`;
      }
      if (step.tip) {
          text += `   > Tip: ${step.tip}\n`;
      }
      text += `\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
            <button 
              onClick={onBack}
              className="flex items-center text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ICONS.ChevronLeft className="w-4 h-4 mr-1" />
              Back to Suggestions
            </button>
            <button
                onClick={handleCopy}
                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50' 
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
            >
                {copied ? <ICONS.Check className="w-3.5 h-3.5 mr-1.5" /> : <ICONS.Clipboard className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copied!' : 'Copy Guide'}
            </button>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">{guide.title}</h2>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {guide.prerequisites.map((prereq, idx) => (
            <div key={idx} className="flex items-center text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
              <ICONS.Wrench className="w-3 h-3 mr-1.5 text-amber-500" />
              {prereq}
            </div>
          ))}
        </div>
      </div>

      {/* Steps Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {guide.steps.map((step, idx) => (
          <div key={idx} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0">
                {step.stepNumber}
              </div>
              {idx !== guide.steps.length - 1 && (
                <div className="w-0.5 h-full bg-slate-800 mt-2"></div>
              )}
            </div>
            
            <div className="flex-1 pb-6">
              {/* Instruction with Tooltip */}
              <div className="relative group/tooltip inline-block mb-2">
                <p className={`text-slate-200 leading-relaxed ${step.tip ? 'cursor-help border-b border-dotted border-slate-600 hover:border-cyan-500 transition-colors' : ''}`}>
                    {step.instruction}
                </p>
                
                {step.tip && (
                    <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none transform translate-y-1 group-hover/tooltip:translate-y-0">
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 border-t border-l border-slate-600 transform rotate-45"></div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <ICONS.Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Insight</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            {step.tip}
                        </p>
                    </div>
                )}
              </div>
              
              {step.selectorDescription && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded p-3 mb-3 text-sm text-slate-400 italic flex items-start">
                   <span className="mr-2 not-italic">👀</span>
                   {step.selectorDescription}
                </div>
              )}

              {step.codeSnippet && (
                <div className="bg-[#0d1117] rounded-lg border border-slate-700 overflow-hidden mt-3">
                  <div className="bg-slate-800/50 px-3 py-1 text-xs text-slate-400 border-b border-slate-700">Code/Script</div>
                  <pre className="p-3 text-xs md:text-sm font-mono text-green-400 overflow-x-auto">
                    <code>{step.codeSnippet}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
        
        <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-center mt-8">
            <h4 className="text-emerald-400 font-semibold mb-1">Automation Complete!</h4>
            <p className="text-emerald-200/70 text-sm">You've successfully set up this workflow.</p>
        </div>
      </div>
    </div>
  );
};

export default GuideView;