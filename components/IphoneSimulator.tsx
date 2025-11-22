import React, { useState, useEffect } from 'react';
import Dialer from './Dialer';

interface IphoneSimulatorProps {
  previewHtml?: string | null;
  children?: React.ReactNode;
}

export const IphoneSimulator: React.FC<IphoneSimulatorProps> = ({ previewHtml, children }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 30); // Update every 30 seconds
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full h-full max-w-[380px] max-h-[822px] aspect-[380/822] flex-shrink-0">
        <div className="w-full h-full bg-black rounded-[60px] shadow-soft-lg shadow-black/50 p-3.5 border-2 border-gray-800 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-black rounded-b-2xl z-20 flex justify-center items-center">
            <div className="w-16 h-2 bg-gray-800 rounded-full mr-4"></div>
            <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
          </div>
          <div className="absolute top-5 left-8 text-white font-bold text-sm z-30">{formattedTime}</div>

          <div className="w-full h-full bg-eburon-bg rounded-[44px] overflow-hidden flex-grow">
             {children ? (
                children
             ) : previewHtml ? (
                <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-none"
                    title="App Preview"
                    sandbox="allow-scripts allow-same-origin"
                />
            ) : (
                <Dialer />
            )}
          </div>
           <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-500 rounded-full"></div>
        </div>
    </div>
  );
};