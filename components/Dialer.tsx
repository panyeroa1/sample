import React, { useState, useRef, useEffect } from 'react';
import * as blandAiService from '../services/blandAiService';
import * as dataService from '../services/dataService';
import { Agent } from '../types';
import { PhoneIcon, GlobeIcon, XIcon } from './icons';
import { AYLA_DEFAULT_AGENT } from '../constants';

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
    onShortPress: () => void;
    onLongPress?: () => void;
}> = ({ label, sublabel, onShortPress, onLongPress }) => {
    const timerRef = useRef<number | null>(null);

    const handlePressStart = () => {
        if (onLongPress) {
            timerRef.current = window.setTimeout(() => {
                onLongPress();
                timerRef.current = null; // Mark as fired
            }, 500); // 500ms threshold for long press
        }
    };

    const handlePressEnd = () => {
        if (timerRef.current) {
            // Timer is still running, so it was a short press
            clearTimeout(timerRef.current);
            timerRef.current = null;
            onShortPress();
        }
        // If timerRef.current is null, the long press has already fired.
    };

    return (
        <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={() => { if (timerRef.current) clearTimeout(timerRef.current); }} // Cancel on leave
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className="bg-eburon-bg hover:bg-eburon-border border border-eburon-border text-eburon-fg rounded-xl py-4 text-xl font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
            {label}
            {sublabel && <div className="text-xs text-eburon-fg/50">{sublabel}</div>}
        </button>
    );
};


const Dialer: React.FC<DialerProps> = () => {
    const [agentMode, setAgentMode] = useState<'mobile' | 'web'>('mobile');
    const [phoneNumber, setPhoneNumber] = useState('+639056741316');
    const [statusText, setStatusText] = useState('Ready to make a call');
    const [callInProgress, setCallInProgress] = useState(false);
    const [statusType, setStatusType] = useState<'default' | 'success' | 'error' | 'info'>('default');

    const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
    const [isLoadingAgent, setIsLoadingAgent] = useState(true);

    useEffect(() => {
        const getAgent = async () => {
            setIsLoadingAgent(true);
            setStatus('Loading agent configuration...', 'info');
            try {
                const agent = await dataService.getActiveDialerAgent();
                if (agent) {
                    setActiveAgent(agent);
                } else {
                    setActiveAgent(AYLA_DEFAULT_AGENT); // Fallback to default
                }
            } catch (error) {
                console.error("Failed to fetch active agent", error);
                setStatus('Could not load agent configuration', 'error');
                setActiveAgent(AYLA_DEFAULT_AGENT); // Also fallback on error
            } finally {
                setIsLoadingAgent(false);
                setStatus('Ready to make a call');
            }
        };
        if (agentMode === 'mobile') {
            getAgent();
        }
    }, [agentMode]);


    const setStatus = (message: string, type: typeof statusType = 'default') => {
        setStatusText(message);
        setStatusType(type);
    };

    const handleMakeCall = async () => {
        if (!activeAgent) {
            setStatus('No agent is configured. Please activate one.', 'error');
            return;
        }
        if (!phoneNumber) {
            setStatus('Please enter a phone number', 'error');
            return;
        }
        if (!phoneNumber.startsWith('+')) {
            setStatus('Please include country code (e.g., +1)', 'error');
            return;
        }

        setCallInProgress(true);
        setStatus(`Calling with ${activeAgent.name}...`, 'info');

        const result = await blandAiService.placeCall(phoneNumber, activeAgent);

        if (result.success && result.call_id) {
            setStatus('Call initiated! Connecting...', 'success');
            setTimeout(() => setStatus('Call connected', 'success'), 4000);
        } else {
            setStatus(result.message || 'Call failed. Please try again.', 'error');
            setCallInProgress(false);
        }
    };

    const handleHangup = () => {
        setCallInProgress(false);
        setStatus('Call ended. Ready for next call.', 'info');
    };

    const handleDialpadInput = (char: string) => {
        if (phoneNumber.length < 20) {
            setPhoneNumber(p => p + char);
        }
    };

    const statusColor = {
        success: 'text-eburon-ok',
        error: 'text-red-400',
        info: 'text-blue-400',
        default: 'text-eburon-fg/60',
    };

    return (
        <div className="w-full h-full flex flex-col bg-eburon-bg text-eburon-fg">
            <header className="pt-14 pb-4 px-4 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-8 w-8" />
                    <h1 className="text-2xl font-bold text-eburon-accent">Eburon Dialer</h1>
                </div>
                <div className="flex items-center gap-1 p-1 bg-eburon-panel rounded-lg">
                    <button onClick={() => setAgentMode('mobile')} className={`p-2 rounded-md ${agentMode === 'mobile' ? 'bg-eburon-accent' : ''}`}>
                        <PhoneIcon className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={() => setAgentMode('web')} className={`p-2 rounded-md ${agentMode === 'web' ? 'bg-eburon-accent' : ''}`}>
                        <GlobeIcon className="w-5 h-5 text-white" />
                    </button>
                </div>
            </header>

            {agentMode === 'mobile' ? (
                <>
                    <div className="p-2 border-y border-eburon-border flex-shrink-0">
                        <div className={`text-center text-sm transition-colors ${statusColor[statusType]}`}>
                            {statusText}
                        </div>
                    </div>

                    <div className="px-6 pt-2 flex-grow flex flex-col">
                        <div className="py-2 text-center">
                            {isLoadingAgent ? (
                                <p className="text-sm text-eburon-fg/60 h-5">Loading agent...</p>
                            ) : activeAgent ? (
                                <p className="text-sm text-eburon-fg/80 h-5">Active Agent: <span className="font-bold text-eburon-accent">{activeAgent.name}</span></p>
                            ) : (
                                <p className="text-sm text-eburon-warn h-5">No active agent selected.</p>
                            )}
                        </div>
                        <div className="py-2">
                            <label className="block text-eburon-fg/80 text-sm font-bold mb-2" htmlFor="phoneNumber">
                                Phone Number
                            </label>
                            <div className="flex space-x-2">
                                <input
                                    type="tel"
                                    id="phoneNumber"
                                    placeholder="+1234567890"
                                    className="flex-1 px-3 py-2 bg-eburon-bg border border-eburon-border rounded-lg focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                                <button
                                    onClick={() => setPhoneNumber('')}
                                    className="px-4 py-2 bg-eburon-bg text-eburon-fg rounded-lg hover:bg-eburon-border transition-colors"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            {DIALPAD_KEYS.map(({ key, sub }) => (
                                <DialpadKey
                                    key={key}
                                    label={key}
                                    sublabel={sub}
                                    onShortPress={() => handleDialpadInput(key)}
                                    onLongPress={key === '0' ? () => handleDialpadInput('+') : undefined}
                                />
                            ))}
                        </div>
                        
                        <div className="mt-auto">
                            {!callInProgress ? (
                                <button
                                    onClick={handleMakeCall}
                                    disabled={!activeAgent || callInProgress || isLoadingAgent}
                                    className="w-full bg-eburon-ok hover:opacity-90 text-black py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    <PhoneIcon className="w-5 h-5" />
                                    <span>Call Customer</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleHangup}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-2"
                                >
                                <PhoneIcon className="w-5 h-5 transform rotate-[135deg]" />
                                    <span>End Call</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-4 text-center text-eburon-fg/50 text-sm border-t border-eburon-border flex-shrink-0">
                        Secure Connection • Eburon
                    </div>
                </>
            ) : (
                <div className="flex-grow bg-black">
                    <iframe
                        src="https://eburon.ai/web-agent/"
                        className="w-full h-full border-none"
                        title="Eburon Web Agent Demo"
                        allow="microphone"
                    ></iframe>
                </div>
            )}
        </div>
    );
};

export default Dialer;
