
import React, { useState, useEffect, useRef } from 'react';
import { PhoneIcon, BrainCircuitIcon, ToggleOnIcon, ToggleOffIcon } from './icons';
import { placeCall } from '../services/blandAiService';
import { getActiveDialerAgent } from '../services/dataService';
import { STEPHEN_DEFAULT_AGENT, STEPHEN_PROMPT, AYLA_PROMPT } from '../constants';
import { Agent } from '../types';
import { useGeminiLiveAgent } from '../hooks/useGeminiLive';

interface DialerProps {}

const DIALPAD_KEYS = [
    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' },
];

const DialpadKey: React.FC<{
    label: string;
    sublabel: string;
    onClick: () => void;
    onLongPress?: () => void;
}> = ({ label, sublabel, onClick, onLongPress }) => {
    const timerRef = useRef<number | null>(null);
    const isLongPress = useRef(false);

    const startPress = () => {
        isLongPress.current = false;
        if (onLongPress) {
            timerRef.current = window.setTimeout(() => {
                isLongPress.current = true;
                onLongPress();
            }, 800); // 800ms for long press
        }
    };

    const endPress = (e: React.TouchEvent | React.MouseEvent) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        
        if (isLongPress.current) {
            e.preventDefault(); // Prevent default click if it was a long press
            return;
        }
        
        // Only trigger click if it wasn't a long press
        onClick();
    };

    return (
        <button
            onMouseDown={startPress}
            onMouseUp={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-all duration-200 backdrop-blur-sm select-none"
        >
            <span className="text-2xl font-normal">{label}</span>
            {sublabel && <span className="text-[8px] text-white/50 font-bold tracking-widest">{sublabel}</span>}
        </button>
    );
};

const Dialer: React.FC<DialerProps> = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [statusText, setStatusText] = useState('Ready');
    const [isCalling, setIsCalling] = useState(false);
    const [activeAgent, setActiveAgent] = useState<Agent>(STEPHEN_DEFAULT_AGENT);
    
    // Web Demo State
    const [isWebDemo, setIsWebDemo] = useState(false);
    const { startSession, endSession, isSessionActive, isConnecting: isWebConnecting } = useGeminiLiveAgent();


    useEffect(() => {
        const loadAgent = async () => {
            try {
                const agent = await getActiveDialerAgent();
                if (agent) {
                    setActiveAgent(agent);
                }
            } catch (e) {
                console.error("Failed to load active agent:", e);
            }
        }
        loadAgent();
    }, []);

    // Sync Web Demo status with UI status
    useEffect(() => {
        if (isWebConnecting) {
            setIsCalling(true);
            setStatusText('Connecting...');
        } else if (isSessionActive) {
            setIsCalling(true);
            setStatusText('Live Session Active');
        } else if (!isSessionActive && !isWebConnecting && isCalling && isWebDemo) {
             // Reset if session ends abruptly from hook side
             setIsCalling(false);
             setStatusText('Ready');
        }
    }, [isSessionActive, isWebConnecting, isWebDemo, isCalling]);


    const handleDialpadInput = (char: string) => {
        if (phoneNumber.length < 15) {
            setPhoneNumber(p => p + char);
        }
    };

    const handleDelete = () => {
        setPhoneNumber(p => p.slice(0, -1));
    };

    const handleCall = async () => {
        if (isCalling || isWebConnecting) return;
        
        // --- WEB DEMO MODE ---
        if (isWebDemo) {
             setIsCalling(true);
             setStatusText('Connecting (Web)...');
             try {
                // Use Ayla's Prompt and Voice ('Aoede') for web demo as requested.
                await startSession(AYLA_PROMPT, undefined, 'Aoede');
             } catch (e: any) {
                console.error("Web Demo Error:", e);
                setStatusText('Connection Failed');
                setIsCalling(false);
                setTimeout(() => setStatusText('Ready'), 2000);
             }
             return;
        }

        // --- STANDARD PHONE CALL MODE ---
        if (!phoneNumber) {
            setStatusText('Enter Number');
            setTimeout(() => setStatusText('Ready'), 2000);
            return;
        }

        setIsCalling(true);
        setStatusText('Initiating Call...');
        
        try {
            // Ensure we have the latest agent config
            const agent = await getActiveDialerAgent() || STEPHEN_DEFAULT_AGENT;
            setActiveAgent(agent);

            const result = await placeCall(phoneNumber, agent);
            
            if (result.success) {
                setStatusText('Call Dispatched');
                // Reset after a few seconds as the call is handled externally
                setTimeout(() => {
                    setStatusText('Call Dispatched');
                    setTimeout(() => {
                         setIsCalling(false);
                         setStatusText('Ready');
                         setPhoneNumber('');
                    }, 2000);
                }, 2000);
            } else {
                console.error(result.message);
                setStatusText('Failed');
                setTimeout(() => {
                    setIsCalling(false);
                    setStatusText('Ready');
                }, 2000);
            }
        } catch (e) {
            console.error("Failed to start call", e);
            setStatusText('Error');
            setTimeout(() => {
                setIsCalling(false);
                setStatusText('Ready');
            }, 2000);
        }
    };
    
    const handleEndCall = () => {
        if (isWebDemo) {
            endSession();
            setIsCalling(false);
            setStatusText('Ready');
        }
        // For phone calls, we can't really "end" them from here once dispatched via API in this context 
        // without tracking call_id separately, but resetting UI is fine.
        if (!isWebDemo && isCalling) {
             setIsCalling(false);
             setStatusText('Ready');
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-black text-white relative overflow-hidden font-sans">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black z-0"></div>

            {/* Header */}
            <div className="relative z-10 pt-6 pb-2 text-center flex flex-col items-center">
                <h2 className="text-sm font-medium text-gray-400 tracking-widest uppercase mb-1">
                    Eburon Dialer
                </h2>
                <div className={`text-xs font-semibold py-1 px-3 rounded-full inline-block transition-colors duration-300 ${isCalling ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {statusText}
                </div>
                
                {/* Web Demo Toggle */}
                <button 
                    onClick={() => {
                        if (!isCalling) {
                            setIsWebDemo(!isWebDemo);
                            setStatusText('Ready');
                        }
                    }}
                    className={`mt-3 flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 ${isWebDemo ? 'bg-purple-900/30 border-purple-500/50 text-purple-300' : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'}`}
                    disabled={isCalling}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider">Web Demo</span>
                    {isWebDemo ? <ToggleOnIcon className="w-4 h-4" /> : <ToggleOffIcon className="w-4 h-4" />}
                </button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center px-6">
                 {/* Agent Info Display (Only if not in Web Demo, or adapt if needed) */}
                <div className="mb-4 text-center transition-opacity duration-300" style={{ opacity: isWebDemo ? 0.5 : 1 }}>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Agent</div>
                    <div className="flex items-center gap-2 justify-center bg-gray-800/50 px-3 py-1.5 rounded-full">
                         <BrainCircuitIcon className={`w-3 h-3 ${isWebDemo ? 'text-purple-400' : 'text-blue-400'}`} />
                         <span className="font-semibold text-sm">{isWebDemo ? 'Ayla (Live)' : activeAgent.name}</span>
                    </div>
                </div>

                {/* Dialpad View */}
                <div className={`w-full max-w-[300px] flex flex-col gap-4 animate-fade-in transition-all duration-300 ${isWebDemo ? 'opacity-30 pointer-events-none blur-sm' : 'opacity-100'}`}>
                    {/* Number Display */}
                    <div className="h-14 flex items-center justify-center mb-2 relative">
                        <span className="text-4xl font-light tracking-wide truncate">
                            {phoneNumber}
                        </span>
                        {phoneNumber && (
                            <button 
                                onClick={handleDelete}
                                className="absolute right-0 p-2 text-gray-500 hover:text-white transition-colors"
                            >
                                ⌫
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-x-6 gap-y-3 justify-items-center">
                        {DIALPAD_KEYS.map(({ key, sub }) => (
                            <DialpadKey
                                key={key}
                                label={key}
                                sublabel={sub}
                                onClick={() => handleDialpadInput(key)}
                                onLongPress={key === '0' ? () => handleDialpadInput('+') : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="relative z-10 pb-8 pt-4 flex justify-center items-center gap-8">
                {isCalling ? (
                     <button
                        onClick={handleEndCall}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 bg-red-600 hover:bg-red-500"
                    >
                        <PhoneIcon className="w-8 h-8 text-white transform rotate-[135deg]" />
                    </button>
                ) : (
                    <button
                        onClick={handleCall}
                        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${isWebDemo ? 'bg-purple-600 hover:bg-purple-500' : 'bg-green-500 hover:bg-green-400'}`}
                    >
                         {isWebConnecting ? (
                             <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                         ) : (
                             <PhoneIcon className="w-8 h-8 text-white" />
                         )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Dialer;
