
import React, { useState } from 'react';
import { PROMPT_LIBRARY } from '../constants';
import { SystemPromptTemplate } from '../types';
import { XIcon, CheckCircleIcon, SearchIcon } from './icons';

interface PromptLibraryModalProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({ onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(PROMPT_LIBRARY.map(p => p.category)))];

  const filteredPrompts = PROMPT_LIBRARY.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prompt.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-eburon-panel border border-eburon-border rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-eburon-border flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-eburon-fg">System Prompt Library</h2>
            <p className="text-eburon-fg/60 text-sm">Select a pre-defined persona to jumpstart your agent.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            data-tooltip="Close Library"
          >
            <XIcon className="w-6 h-6 text-eburon-fg/70" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-eburon-border flex gap-4 flex-wrap bg-eburon-bg/30 flex-shrink-0">
           <div className="relative flex-grow max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-eburon-fg/50" />
              <input 
                type="text" 
                placeholder="Search templates..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-eburon-bg border border-eburon-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-eburon-accent"
              />
           </div>
           <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat 
                      ? 'bg-eburon-accent text-white' 
                      : 'bg-eburon-bg border border-eburon-border text-eburon-fg/70 hover:bg-eburon-border'
                  }`}
                >
                  {cat}
                </button>
              ))}
           </div>
        </div>

        {/* List */}
        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map(prompt => (
            <div key={prompt.id} className="bg-eburon-bg border border-eburon-border rounded-xl p-4 flex flex-col hover:border-eburon-accent/50 transition-colors">
               <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 rounded bg-eburon-panel border border-eburon-border text-[10px] text-eburon-accent font-mono uppercase tracking-wide">
                    {prompt.category}
                  </span>
               </div>
               <h3 className="text-lg font-bold text-eburon-fg mb-1">{prompt.title}</h3>
               <p className="text-sm text-eburon-fg/60 mb-4 line-clamp-2 h-10">{prompt.description}</p>
               
               <div className="flex-grow bg-black/20 rounded-lg p-3 mb-4 overflow-hidden relative group">
                  <pre className="text-xs text-eburon-fg/80 font-mono whitespace-pre-wrap line-clamp-6 font-light">
                    {prompt.content}
                  </pre>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-eburon-bg/50 to-transparent"></div>
               </div>

               <button 
                 onClick={() => {
                   onSelect(prompt.content);
                   onClose();
                 }}
                 className="w-full py-2 bg-eburon-panel hover:bg-eburon-accent text-eburon-fg hover:text-white rounded-lg border border-eburon-border hover:border-eburon-accent transition-all flex items-center justify-center gap-2 font-medium text-sm"
               >
                 <CheckCircleIcon className="w-4 h-4" />
                 Use Template
               </button>
            </div>
          ))}
          
          {filteredPrompts.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center py-12 text-eburon-fg/50">
                <SearchIcon className="w-12 h-12 mb-2 opacity-20" />
                <p>No templates found matching your criteria.</p>
             </div>
          )}
        </div>

      </div>
    </div>
  );
};
