
import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
    BrainCircuitIcon, 
    ServerIcon, 
    DatabaseIcon,
    LockIcon,
    SunIcon,
    MoonIcon,
    TwitterIcon,
    GitHubIcon,
    LinkedInIcon,
    PhoneIcon,
    MessageCircleIcon,
    UserIcon,
    GlobeIcon,
    CpuIcon,
    ShieldIcon,
    CheckCircleIcon,
    SpeakerIcon
} from './icons';

interface LandingPageProps {
    onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
    const { theme: globalTheme, toggleTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);

    // Map context theme string to boolean for compatibility with existing logic
    const isDarkMode = globalTheme === 'dark';

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrolled(e.currentTarget.scrollTop > 50);
    };

    // Dynamic classes based on theme for high contrast
    const theme = {
        bg: isDarkMode ? 'bg-[#030305]' : 'bg-[#FFFFFF]',
        text: isDarkMode ? 'text-white' : 'text-slate-900',
        textMuted: isDarkMode ? 'text-gray-400' : 'text-slate-600',
        panel: isDarkMode ? 'bg-[#0E0E11]' : 'bg-white',
        panelHover: isDarkMode ? 'hover:bg-[#131316]' : 'hover:bg-slate-50',
        border: isDarkMode ? 'border-white/10' : 'border-slate-200',
        navBg: isDarkMode ? 'bg-[#030305]/90' : 'bg-white/90',
        cardHover: isDarkMode ? 'hover:border-blue-500/50' : 'hover:border-blue-500/50 hover:shadow-xl',
        gradientText: isDarkMode 
            ? 'bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-400 to-purple-400' 
            : 'bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-blue-600 to-purple-600',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30',
        buttonSecondary: isDarkMode 
            ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
            : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-900',
    };

    // Using the root asset icon
    const LOGO_URL = "https://eburon.ai/assets/icon-eburon.png";

    return (
        <div 
            className={`h-screen w-full font-sans transition-colors duration-500 ${theme.bg} ${theme.text} overflow-y-auto overflow-x-hidden selection:bg-blue-500/30 scroll-smooth`}
            onScroll={handleScroll}
        >
            
            {/* Background Ambient Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-[-10%] left-1/2 -translate-x-1/2 w-[100vw] h-[100vh] rounded-full blur-[120px] opacity-40 transition-colors duration-700 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-100/60'}`}></div>
                <div className={`absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vh] rounded-full blur-[100px] opacity-30 transition-colors duration-700 ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-100/60'}`}></div>
                <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] ${isDarkMode ? 'opacity-20' : 'opacity-5'} mix-blend-overlay`}></div>
            </div>

            {/* Navbar */}
            <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${scrolled ? `${theme.navBg} ${theme.border} backdrop-blur-xl py-3 shadow-sm` : 'bg-transparent border-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div 
                        className="flex items-center gap-3 cursor-pointer group" 
                        onClick={() => {
                            const container = document.querySelector('.overflow-y-auto');
                            container?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
                            <img 
                                src={LOGO_URL} 
                                alt="Eburon Logo" 
                                className={`h-10 w-10 object-contain relative z-10 drop-shadow-md transition-all duration-300 ${!isDarkMode ? 'invert' : ''}`} 
                            />
                        </div>
                        <span className={`text-2xl font-bold tracking-tight ${theme.text}`}>Eburon</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        {['Platform', 'Solutions', 'Enterprise'].map((item) => (
                            <a 
                                key={item} 
                                href={`#${item.toLowerCase()}`} 
                                className={`text-sm font-medium transition-colors hover:text-blue-500 ${theme.textMuted} hover:${theme.text}`}
                            >
                                {item}
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={toggleTheme}
                            className={`p-2.5 rounded-full transition-all duration-300 border ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10 text-yellow-300' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}
                            aria-label="Toggle Theme"
                        >
                            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={onEnterApp} 
                            className={`hidden md:block text-sm font-bold transition-colors hover:text-blue-500 ${theme.text}`}
                        >
                            Log in
                        </button>
                        <button 
                            onClick={onEnterApp} 
                            className={`${theme.buttonPrimary} px-6 py-2.5 rounded-full text-sm font-bold transition-all transform hover:scale-105 active:scale-95`}
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-32 pb-16 px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
                    <div className="text-left animate-fade-in relative z-20">
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 cursor-default transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-blue-400' : 'bg-white border-gray-200 text-blue-700 shadow-sm'}`}>
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-bold tracking-wide uppercase">Eburon Studio v2.0</span>
                        </div>
                        
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
                            The Voice of <br />
                            <span className={theme.gradientText}>Intelligence.</span>
                        </h1>
                        
                        <p className={`text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed ${theme.textMuted}`}>
                            Orchestrate hyper-realistic voice agents at the edge. Complete sovereignty, zero latency, and human-grade empathy for enterprise applications.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
                            <button 
                                onClick={onEnterApp} 
                                className={`${theme.buttonPrimary} px-8 py-4 rounded-2xl font-bold text-lg w-full sm:w-auto flex items-center justify-center gap-2 group`}
                            >
                                Start Building Free
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                            </button>
                            <button 
                                className={`${theme.buttonSecondary} px-8 py-4 rounded-2xl font-bold text-lg w-full sm:w-auto`}
                            >
                                View Documentation
                            </button>
                        </div>
                    </div>

                    {/* Hero Image */}
                    <div className="relative animate-slide-up hidden lg:block z-10 perspective-1000">
                         {/* Ambient Glow Behind Image */}
                         <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-600/20 to-purple-600/20 rounded-full blur-[100px] -z-10`}></div>

                        <div className={`relative rounded-2xl overflow-hidden shadow-2xl border ${theme.border} group transform transition-all duration-500 hover:scale-[1.01] hover:shadow-blue-500/10`}>
                            {/* High-Quality Sound Wave/Voice Abstract Image */}
                             <img 
                                src="https://eburon.ai/assets/hero.png" 
                                alt="Eburon Voice Intelligence Engine - Abstract Voice Waves" 
                                className="object-cover h-[600px] w-full transform transition-transform duration-700 group-hover:scale-105"
                            />
                            
                            {/* Subtle Overlay for Depth */}
                            <div className={`absolute inset-0 bg-gradient-to-t ${isDarkMode ? 'from-[#030305] via-transparent to-transparent' : 'from-white via-transparent to-transparent'} opacity-20`}></div>
                            
                            {/* Floating UI Elements - Glassmorphism */}
                            <div className={`absolute bottom-10 left-10 p-5 rounded-2xl shadow-2xl border backdrop-blur-xl ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white/80 border-white/40'} max-w-xs transform transition-all duration-500 hover:-translate-y-2`}>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                                    </div>
                                    <div>
                                        <div className={`h-2.5 w-24 rounded-full mb-1.5 ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`}></div>
                                        <div className={`h-2 w-16 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className={`h-2 w-full rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                                    <div className={`h-2 w-full rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                                    <div className={`h-2 w-2/3 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                                </div>
                            </div>

                            {/* Top Right Badge */}
                            <div className={`absolute top-6 right-6 px-4 py-2 rounded-full border backdrop-blur-md ${isDarkMode ? 'bg-black/30 border-white/10 text-white/90' : 'bg-white/80 border-gray-200 text-gray-800'} text-xs font-bold shadow-lg flex items-center gap-2`}>
                                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                                Voice Engine Active
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Voice Demo Section */}
            <div className="relative z-20 -mt-8 mb-16 flex justify-center animate-fade-in px-4">
                 <div className={`rounded-3xl p-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-2xl max-w-3xl w-full transform transition-transform hover:scale-[1.01]`}>
                    <div className={`${theme.panel} rounded-[23px] p-6 md:p-8 flex flex-col md:flex-row items-center gap-8`}>
                        <div className="flex-shrink-0 flex flex-col items-center md:items-start gap-3 text-center md:text-left">
                             <div className="flex items-center gap-2 mb-1">
                                <div className="p-2 bg-eburon-accent/10 rounded-full">
                                    <SpeakerIcon className="w-5 h-5 text-eburon-accent" />
                                </div>
                                <span className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted}`}>Audio Sample</span>
                             </div>
                             <h3 className={`text-xl font-bold ${theme.text}`}>Hear the Difference</h3>
                             <p className={`text-sm ${theme.textMuted} max-w-xs italic`}>"Listen to how expressive the Eburon Voice Model is in a real-world scenario."</p>
                        </div>
                        <div className="w-full bg-black/5 dark:bg-white/5 rounded-xl p-4 flex items-center justify-center border border-white/10">
                            <audio controls className="w-full h-12 outline-none focus:outline-none" style={{ filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none' }}>
                                <source src="https://eburon.ai/calling-demo/csr.mp3" type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Platform Section (Bento Grid) */}
            <section id="platform" className={`py-24 px-6 relative z-10 scroll-mt-20`}>
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16 max-w-3xl animate-fade-in">
                        <h2 className={`text-3xl md:text-5xl font-bold mb-6 ${theme.text}`}>Engineered for Scale.</h2>
                        <p className={`text-lg ${theme.textMuted}`}>Deploy conversational AI that feels human, costs less, and runs anywhere.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(240px,auto)]">
                        {/* Card 1: Sovereign Intelligence */}
                        <div className={`md:col-span-2 ${theme.panel} ${theme.border} border rounded-3xl p-8 relative overflow-hidden group transition-all duration-500 ${theme.cardHover} animate-slide-up`}>
                            <div className="absolute inset-0 z-0">
                                <img 
                                    src="https://images.unsplash.com/photo-1558494949-efc5e60dc810?q=80&w=2000&auto=format&fit=crop" 
                                    alt="Server Infrastructure" 
                                    className="w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity duration-700 mix-blend-luminosity"
                                />
                                <div className={`absolute inset-0 bg-gradient-to-t ${isDarkMode ? 'from-[#0E0E11] via-[#0E0E11]/90' : 'from-white via-white/90'} to-transparent`}></div>
                            </div>
                            
                            <div className="relative z-10 h-full flex flex-col justify-end">
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 text-blue-500 border border-blue-500/20 backdrop-blur-sm">
                                    <BrainCircuitIcon className="w-7 h-7" />
                                </div>
                                <h3 className={`text-2xl font-bold mb-3 ${theme.text}`}>Sovereign Intelligence</h3>
                                <p className={`${theme.textMuted} max-w-lg text-lg`}>Run models on your own infrastructure. Data never leaves your perimeter, ensuring complete privacy and compliance with global standards.</p>
                            </div>
                        </div>

                        {/* Card 2: NoTokens */}
                        <div className={`${theme.panel} ${theme.border} border rounded-3xl p-8 transition-all duration-500 ${theme.cardHover} group relative overflow-hidden flex flex-col justify-between shadow-sm animate-slide-up [animation-delay:100ms]`}>
                            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] -mr-10 -mt-10 transition-all group-hover:bg-purple-500/20"></div>
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 text-purple-500 z-10 border border-purple-500/20">
                                <DatabaseIcon className="w-6 h-6" />
                            </div>
                            <div className="z-10">
                                <h3 className={`text-xl font-bold mb-2 ${theme.text}`}>NoTokens™ Pricing</h3>
                                <p className={`text-sm ${theme.textMuted}`}>Forget unpredictable per-token costs. Pay for compute, not conversation length.</p>
                            </div>
                        </div>

                        {/* Card 3: Edge Ready */}
                        <div className={`${theme.panel} ${theme.border} border rounded-3xl p-8 transition-all duration-500 ${theme.cardHover} group relative overflow-hidden flex flex-col justify-between shadow-sm animate-slide-up [animation-delay:200ms]`}>
                             <img 
                                src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop" 
                                alt="Chip Texture" 
                                className="absolute inset-0 w-full h-full object-cover opacity-5 group-hover:opacity-10 transition-opacity mix-blend-overlay" 
                            />
                            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6 text-green-500 z-10 border border-green-500/20">
                                <ServerIcon className="w-6 h-6" />
                            </div>
                            <div className="z-10">
                                <h3 className={`text-xl font-bold mb-2 ${theme.text}`}>Edge Ready</h3>
                                <p className={`text-sm ${theme.textMuted}`}>Optimized for low-latency edge deployment. From data centers to on-premise racks.</p>
                            </div>
                        </div>

                         {/* Card 4: Enterprise Security */}
                         <div className={`md:col-span-2 ${theme.panel} ${theme.border} border rounded-3xl p-8 transition-all duration-500 ${theme.cardHover} relative overflow-hidden flex flex-col justify-center min-h-[280px] animate-slide-up [animation-delay:300ms]`}>
                            <div className="absolute inset-0 z-0">
                                <img 
                                    src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2000&auto=format&fit=crop" 
                                    alt="Cybersecurity" 
                                    className="w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity mix-blend-luminosity"
                                />
                                <div className={`absolute inset-0 bg-gradient-to-r ${isDarkMode ? 'from-[#0E0E11] via-[#0E0E11]/90' : 'from-white via-white/90'} to-transparent`}></div>
                            </div>
                            <div className="relative z-10 max-w-md">
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-6 text-orange-500 border border-orange-500/20">
                                    <LockIcon className="w-6 h-6" />
                                </div>
                                <h3 className={`text-2xl font-bold mb-3 ${theme.text}`}>Enterprise Security</h3>
                                <p className={`${theme.textMuted} text-lg`}>Post-quantum encryption standards, proprietary DYNCA authentication, and full audit trails built-in by default.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Solutions Section */}
            <section id="solutions" className={`py-24 px-6 relative z-10 border-t ${theme.border} scroll-mt-20`}>
                <div className="max-w-7xl mx-auto">
                     <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
                         <span className="text-blue-500 font-bold tracking-wider text-sm uppercase mb-2 block">Industries</span>
                         <h2 className={`text-4xl md:text-5xl font-bold mb-6 ${theme.text}`}>Built for Critical Missions.</h2>
                         <p className={`text-lg ${theme.textMuted}`}>
                             From handling millions of support calls to automating complex sales funnels, Eburon adapts to your industry's unique voice.
                         </p>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         {[
                             {
                                 icon: PhoneIcon,
                                 title: "Customer Support",
                                 desc: "Automate 80% of tier-1 inquiries with zero wait times. Empathy engine ensures customers feel heard, not processed."
                             },
                             {
                                 icon: MessageCircleIcon,
                                 title: "Sales & Lead Gen",
                                 desc: "Qualify leads 24/7. Eburon engages prospects with natural conversation, booking meetings directly into your CRM."
                             },
                             {
                                 icon: UserIcon,
                                 title: "Healthcare Triage",
                                 desc: "HIPAA-compliant voice assistants that schedule appointments, handle refills, and provide pre-visit instructions."
                             },
                             {
                                 icon: GlobeIcon,
                                 title: "Global Localization",
                                 desc: "Instantly deploy agents in 120+ languages with native-level accents and cultural nuance adaptation."
                             },
                             {
                                 icon: CpuIcon,
                                 title: "Technical Operations",
                                 desc: "Voice-activated infrastructure management. Let engineers talk to servers to diagnose issues or deploy builds."
                             },
                             {
                                 icon: BrainCircuitIcon,
                                 title: "Knowledge Management",
                                 desc: "Turn your internal documentation into an interactive voice expert that answers employee questions instantly."
                             }
                         ].map((item, idx) => (
                             <div 
                                key={idx} 
                                className={`${theme.panel} border ${theme.border} p-8 rounded-2xl transition-all duration-300 ${theme.panelHover} group animate-slide-up`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                             >
                                 <div className={`w-12 h-12 rounded-xl mb-6 flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-white' : 'bg-blue-50 text-blue-600'} group-hover:scale-110 transition-transform duration-300`}>
                                     <item.icon className="w-6 h-6" />
                                 </div>
                                 <h3 className={`text-xl font-bold mb-3 ${theme.text}`}>{item.title}</h3>
                                 <p className={`text-sm leading-relaxed ${theme.textMuted}`}>{item.desc}</p>
                             </div>
                         ))}
                     </div>
                </div>
            </section>

            {/* Enterprise Section */}
            <section id="enterprise" className={`py-24 px-6 relative z-10 scroll-mt-20 ${isDarkMode ? 'bg-gradient-to-b from-[#030305] to-[#0A0A0D]' : 'bg-slate-50'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 animate-slide-up">
                            <div className={`border ${theme.border} rounded-3xl p-2 bg-white/5 backdrop-blur-sm`}>
                                <img 
                                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop" 
                                    alt="Enterprise Dashboard" 
                                    className="rounded-2xl shadow-2xl w-full object-cover"
                                />
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 animate-fade-in">
                             <h2 className={`text-3xl md:text-4xl font-bold mb-6 ${theme.text}`}>Enterprise-Grade Control.</h2>
                             <p className={`text-lg ${theme.textMuted} mb-8`}>
                                 When data sovereignty is non-negotiable, Eburon delivers. Full on-premise deployment options, custom model fine-tuning, and dedicated support channels.
                             </p>
                             
                             <ul className="space-y-6">
                                 {[
                                     { title: "Custom Model Fine-Tuning", desc: "Train Eburon on your proprietary data sets without exposing them to public clouds." },
                                     { title: "SLA-Backed Uptime", desc: "99.99% availability guarantee with 24/7 dedicated engineering support." },
                                     { title: "Audit & Compliance", desc: "Full conversation logs, sentiment analysis, and regulatory compliance reporting." }
                                 ].map((feature, i) => (
                                     <li key={i} className="flex gap-4">
                                         <div className="mt-1">
                                             <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                                 <CheckCircleIcon className="w-4 h-4" />
                                             </div>
                                         </div>
                                         <div>
                                             <h4 className={`font-bold ${theme.text}`}>{feature.title}</h4>
                                             <p className={`text-sm ${theme.textMuted}`}>{feature.desc}</p>
                                         </div>
                                     </li>
                                 ))}
                             </ul>

                             <div className="mt-10 pt-10 border-t border-dashed border-gray-700/50">
                                 <div className="flex flex-col sm:flex-row gap-4">
                                     <button onClick={onEnterApp} className={`${theme.buttonPrimary} px-6 py-3 rounded-xl font-bold text-sm`}>
                                         Contact Sales
                                     </button>
                                     <button className={`${theme.buttonSecondary} px-6 py-3 rounded-xl font-bold text-sm`}>
                                         Read Case Studies
                                     </button>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* CTA Section */}
            <section className="py-24 px-6 relative z-10">
                <div className="max-w-5xl mx-auto text-center">
                    <div className={`relative rounded-3xl p-12 overflow-hidden border ${theme.border} ${isDarkMode ? 'bg-[#0E0E11]' : 'bg-white shadow-xl'}`}>
                         {/* Background Glow */}
                         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
                         
                         <h2 className={`text-4xl md:text-5xl font-bold mb-6 relative z-10 ${theme.text}`}>Ready to deploy?</h2>
                         <p className={`text-xl ${theme.textMuted} max-w-2xl mx-auto mb-10 relative z-10`}>
                             Join thousands of developers building the future of voice. <br/> No credit card required for development sandbox.
                         </p>
                         
                         <button 
                            onClick={onEnterApp}
                            className={`${theme.buttonPrimary} px-10 py-4 rounded-full font-bold text-lg relative z-10 transform transition-transform hover:scale-105`}
                        >
                             Launch Console
                         </button>
                    </div>
                </div>
            </section>

            {/* Stats/Trust Section */}
            <div className={`py-20 border-y ${theme.border} relative z-10 ${isDarkMode ? 'bg-[#050507]' : 'bg-gray-50'}`}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                        {[
                            { label: "Latency", value: "< 500ms" },
                            { label: "Languages", value: "120+" },
                            { label: "Uptime", value: "99.99%" },
                            { label: "Cost Savings", value: "3-5x" }
                        ].map((stat, idx) => (
                            <div key={idx} className="space-y-2 group cursor-default">
                                <div className={`text-4xl md:text-5xl font-bold ${theme.text} group-hover:text-blue-500 transition-colors duration-300`}>{stat.value}</div>
                                <div className={`text-sm font-bold uppercase tracking-widest ${theme.textMuted}`}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className={`border-t ${theme.border} ${isDarkMode ? 'bg-[#030305]' : 'bg-white'} pt-20 pb-10 px-6 relative z-10`}>
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 mb-16">
                    <div className="col-span-2 lg:col-span-2 pr-8">
                        <a href="#" className="flex items-center gap-3 mb-6 group">
                            <img 
                                src={LOGO_URL} 
                                alt="Eburon" 
                                className={`h-8 w-8 opacity-90 group-hover:opacity-100 transition-all ${!isDarkMode ? 'invert' : ''}`} 
                            />
                            <span className={`font-bold text-xl ${theme.text}`}>Eburon.ai</span>
                        </a>
                        <p className={`text-sm ${theme.textMuted} leading-relaxed mb-6`}>
                            Next-generation conversational AI studio. <br/>
                            Rooted in Belgium. Serving the World.
                        </p>
                        <div className="flex gap-4">
                            {[TwitterIcon, GitHubIcon, LinkedInIcon].map((Icon, i) => (
                                <a key={i} href="#" className={`${theme.textMuted} hover:text-blue-500 transition-colors p-2 hover:bg-blue-500/10 rounded-lg`}>
                                    <Icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <h4 className={`font-bold mb-6 ${theme.text}`}>Platform</h4>
                        <ul className={`space-y-4 text-sm ${theme.textMuted}`}>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Studio</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Edge Engine</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Integrations</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Security</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className={`font-bold mb-6 ${theme.text}`}>Solutions</h4>
                        <ul className={`space-y-4 text-sm ${theme.textMuted}`}>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Customer Support</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Sales Automation</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Healthcare</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Finance</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className={`font-bold mb-6 ${theme.text}`}>Resources</h4>
                        <ul className={`space-y-4 text-sm ${theme.textMuted}`}>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">API Reference</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Community</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Blog</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className={`font-bold mb-6 ${theme.text}`}>Company</h4>
                        <ul className={`space-y-4 text-sm ${theme.textMuted}`}>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Legal</a></li>
                            <li><a href="#" className="hover:text-blue-500 transition-colors">Contact</a></li>
                        </ul>
                    </div>
                </div>
                
                <div className={`max-w-7xl mx-auto pt-8 border-t ${theme.border} flex flex-col md:flex-row justify-between items-center gap-4`}>
                    <span className={`text-xs ${theme.textMuted}`}>© 2025 Eburon AI. All rights reserved.</span>
                    <div className="flex gap-6 text-xs font-medium">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-600">All Systems Operational</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
