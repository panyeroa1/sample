import React from 'react';

interface LoadingIndicatorProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ text, size = 'medium' }) => {
  // Skeleton loader variant
  if (size === 'large') {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-eburon-bg p-8 animate-fade-in">
          <div className="w-full max-w-2xl space-y-6">
             <div className="flex items-center space-x-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-eburon-panel animate-pulse"></div>
                <div className="space-y-2">
                    <div className="h-4 w-48 bg-eburon-panel rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-eburon-panel rounded animate-pulse"></div>
                </div>
             </div>
             <div className="space-y-3">
                <div className="h-32 w-full bg-eburon-panel rounded-2xl animate-pulse"></div>
                <div className="flex gap-4">
                    <div className="h-32 w-1/2 bg-eburon-panel rounded-2xl animate-pulse"></div>
                    <div className="h-32 w-1/2 bg-eburon-panel rounded-2xl animate-pulse"></div>
                </div>
             </div>
             <p className="text-center text-eburon-fg/40 text-sm font-medium mt-6 tracking-wider uppercase">{text || "Initializing..."}</p>
          </div>
        </div>
      );
  }

  // Minimal spinner for smaller contexts
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12', // Not used due to skeleton above, but kept for type safety
  };

  return (
    <div className="flex items-center justify-center gap-3 text-eburon-fg/60">
       <svg className={`animate-spin text-eburon-accent ${sizeClasses[size]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {text && <span className="text-sm font-medium">{text}</span>}
    </div>
  );
};