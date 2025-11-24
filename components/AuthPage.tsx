
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { GoogleIcon, MailIcon, LockIcon } from './icons';

type AuthView = 'signIn' | 'signUp' | 'resetPassword';

const AuthPage: React.FC = () => {
    const [view, setView] = useState<AuthView>('signIn');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            let response;
            switch (view) {
                case 'signUp':
                    response = await supabase.auth.signUp({ email, password });
                    if (!response.error) setMessage('Check your email for the confirmation link!');
                    break;
                case 'signIn':
                    response = await supabase.auth.signInWithPassword({ email, password });
                    break;
                case 'resetPassword':
                    response = await supabase.auth.resetPasswordForEmail(email);
                    if (!response.error) setMessage('Check your email for the password reset link!');
                    break;
            }
            if (response && response.error) {
                setError(response.error.message);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        // Using window.location.origin ensures the redirect comes back to the correct deployment (localhost or production)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    const getTitle = () => {
        switch (view) {
            case 'signIn': return 'Sign In to Your Account';
            case 'signUp': return 'Create a New Account';
            case 'resetPassword': return 'Reset Your Password';
        }
    }
    
    const getButtonText = () => {
        switch (view) {
            case 'signIn': return 'Sign In';
            case 'signUp': return 'Sign Up';
            case 'resetPassword': return 'Send Reset Link';
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-eburon-bg text-eburon-fg p-4">
            <div className="w-full max-w-md bg-eburon-panel border border-eburon-border rounded-xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-16 w-16 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold">Welcome to Eburon<span className="text-eburon-accent">.ai</span></h1>
                    <p className="text-eburon-fg/70 mt-2">{getTitle()}</p>
                </div>

                {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-center text-sm">{error}</div>}
                {message && <div className="bg-green-900/50 border border-eburon-ok text-green-300 p-3 rounded-lg mb-4 text-center text-sm">{message}</div>}

                <form onSubmit={handleAuthAction} className="space-y-4">
                    <div className="relative">
                        <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                        />
                    </div>
                    {view !== 'resetPassword' && (
                        <div className="relative">
                            <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                            />
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-600"
                    >
                        {loading ? <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : getButtonText()}
                    </button>
                </form>

                <div className="flex items-center my-6">
                    <hr className="flex-grow border-eburon-border" />
                    <span className="px-4 text-sm text-eburon-fg/60">OR</span>
                    <hr className="flex-grow border-eburon-border" />
                </div>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-eburon-bg border border-eburon-border hover:bg-white/5 text-eburon-fg font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-3"
                >
                    <GoogleIcon className="w-5 h-5" />
                    Sign In with Google
                </button>

                <div className="text-center mt-6 text-sm">
                    {view === 'signIn' && (
                        <p className="text-eburon-fg/70">
                            Don't have an account? <button onClick={() => setView('signUp')} className="font-semibold text-eburon-accent hover:underline">Sign Up</button>
                        </p>
                    )}
                    {view === 'signUp' && (
                        <p className="text-eburon-fg/70">
                            Already have an account? <button onClick={() => setView('signIn')} className="font-semibold text-eburon-accent hover:underline">Sign In</button>
                        </p>
                    )}
                    <p className="mt-2">
                        <button onClick={() => setView('resetPassword')} className="text-sm text-eburon-fg/60 hover:underline">Forgot password?</button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
