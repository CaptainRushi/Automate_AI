import React, { useEffect, useState } from 'react';
import { DetailedGuide, HistoryItem } from '../types';
import { getHistory, clearHistory } from '../services/storageService';
import { ICONS } from '../constants';

interface HistoryViewProps {
  onSelectGuide: (guide: DetailedGuide) => void;
  onClose: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onSelectGuide, onClose }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setHistoryItems(getHistory());
  }, []);

  const handleClear = () => {
      if (isConfirmingClear) {
          clearHistory();
          setHistoryItems([]);
          setIsConfirmingClear(false);
      } else {
          setIsConfirmingClear(true);
          // Reset confirmation state after 3 seconds
          setTimeout(() => setIsConfirmingClear(false), 3000);
      }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredItems = historyItems
    .filter(item => {
      const term = searchTerm.toLowerCase();
      return (
        item.guide.title.toLowerCase().includes(term) ||
        item.guide.prerequisites.some(p => p.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center">
            <ICONS.History className="w-5 h-5 mr-2 text-cyan-400" />
            Guide History
            </h2>
            <div className="flex gap-2 items-center">
                {historyItems.length > 0 && (
                    <button 
                    onClick={handleClear}
                    className={`text-xs px-3 py-1.5 rounded transition-all duration-200 ${
                        isConfirmingClear 
                        ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)] font-medium' 
                        : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                    }`}
                >
                    {isConfirmingClear ? 'Confirm Clear?' : 'Clear'}
                </button>
                )}
                <button 
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-800 transition-colors"
                >
                Close
                </button>
            </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex gap-3">
             <div className="relative flex-1 group">
                <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search titles or keywords..."
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
             </div>
             <button
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center px-3 py-2 bg-slate-950/50 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-all min-w-[100px] justify-center group"
             >
                <ICONS.Sort className={`w-3.5 h-3.5 mr-2 transition-transform duration-300 ${sortOrder === 'oldest' ? 'rotate-180' : ''}`} />
                {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
             </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {historyItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <ICONS.History className="w-12 h-12 mb-4 opacity-20" />
            <p>No history yet.</p>
            <p className="text-sm mt-2">Guides you generate will appear here.</p>
          </div>
        ) : filteredItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-48 text-slate-500">
             <ICONS.Search className="w-8 h-8 mb-3 opacity-20" />
             <p className="text-sm">No matches found for "{searchTerm}"</p>
           </div>
        ) : (
          filteredItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelectGuide(item.guide)}
              className="group bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-1">
                  {item.guide.title}
                </h3>
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap ml-2">
                  {formatDate(item.timestamp)}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mb-3">
                 {item.guide.prerequisites.slice(0, 3).map((pre, idx) => (
                     <span key={idx} className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                         {pre}
                     </span>
                 ))}
                 {item.guide.prerequisites.length > 3 && (
                     <span className="text-[10px] text-slate-500 py-0.5">+ {item.guide.prerequisites.length - 3} more</span>
                 )}
              </div>

              <div className="flex items-center text-xs text-cyan-500/80 group-hover:text-cyan-400">
                <span className="mr-1">View Saved Guide</span>
                <ICONS.ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;