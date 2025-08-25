

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Shield, Loader2, AlertTriangle, CheckCircle, QrCode, X, Keyboard } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import ShortcutsList from './ShortcutsList';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, userEmail }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
    const [isConfirmingUnenroll, setIsConfirmingUnenroll] = useState(false);

    const checkEnrollmentStatus = async () => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        const { data, error } = await supabase.auth.mfa.listFactors();

        if (error) {
            setError(error.message);
        } else {
            const totpFactor = data.totp[0];
            if (totpFactor && totpFactor.status === 'verified') {
                setIsEnrolled(true);
                setEnrolledFactorId(totpFactor.id);
            } else {
                setIsEnrolled(false);
                setQrCode(null);
                setEnrolledFactorId(null);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            checkEnrollmentStatus();
        } else {
            // Reset confirmation state when modal is closed
            setIsConfirmingUnenroll(false);
        }
    }, [isOpen]);

    const handleEnroll = async () => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        
        if (enrollError) {
            setError(enrollError.message);
            setIsLoading(false);
            return;
        }

        setQrCode(data.totp.qr_code);
        setEnrolledFactorId(data.id);
        setIsLoading(false);
    };
    
    const handleChallengeAndVerify = async () => {
        if (!enrolledFactorId) {
            setError("Factor ID not found. Please try enrolling again.");
            return;
        }
        setIsLoading(true);
        setError(null);

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
            factorId: enrolledFactorId,
            code: verificationCode,
        });

        if (verifyError) {
            setError(verifyError.message);
            setIsLoading(false);
            return;
        }

        setMessage('2FA has been successfully enabled!');
        setQrCode(null);
        setVerificationCode('');
        await checkEnrollmentStatus();
        setIsLoading(false);
    };
    
    const handleUnenrollRequest = () => {
        if (!enrolledFactorId) {
            setError("Could not find the 2FA factor to disable. Please refresh and try again.");
            return;
        }
        setIsConfirmingUnenroll(true);
        setMessage(null);
        setError(null);
    };
    
    const confirmAndUnenroll = async () => {
        if (!enrolledFactorId) {
            setError("Factor ID missing. Cannot unenroll.");
            setIsConfirmingUnenroll(false);
            return;
        }
    
        setIsLoading(true);
        setError(null);
    
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
        if (unenrollError) {
            setError(unenrollError.message);
        } else {
            setMessage('2FA has been successfully disabled.');
            await checkEnrollmentStatus(); // This will correctly update the state
        }
        setIsLoading(false);
        setIsConfirmingUnenroll(false);
    };

    if (!isOpen) {
        return null;
    }

    const render2FAContent = () => {
        if (isLoading && !qrCode && !isEnrolled) {
            return (
                <div className="flex items-center justify-center h-48 text-content-muted">
                    <Loader2 size={32} className="animate-spin" />
                </div>
            );
        }
        
        if (isConfirmingUnenroll) {
            return (
                <div className="bg-danger-secondary/20 border border-danger-primary/50 p-4 rounded-lg">
                    <h3 className="font-bold text-danger-primary">Confirm Disabling 2FA</h3>
                    <p className="text-sm text-content-secondary mt-2 mb-4">
                        Are you sure you want to remove two-factor authentication? Your account will be less secure.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setIsConfirmingUnenroll(false)}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-background-interactive text-content-inverted hover:bg-background-interactive-hover transition text-sm font-semibold"
                        >
                            Cancel
                        </button>
                         <button 
                            onClick={confirmAndUnenroll}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-danger-primary text-content-inverted hover:bg-danger-secondary transition text-sm font-semibold flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Disable'}
                        </button>
                    </div>
                </div>
            )
        }

        return (
            <>
                {error && <div className="p-3 mb-4 rounded-lg flex items-center gap-2 text-sm bg-danger-primary/20 text-danger-primary"><AlertTriangle size={18}/>{error}</div>}
                {message && <div className="p-3 mb-4 rounded-lg flex items-center gap-2 text-sm bg-success-primary/20 text-success-primary"><CheckCircle size={18}/>{message}</div>}

                {isEnrolled ? (
                    <div>
                        <div className="p-4 rounded-lg flex items-center gap-3 bg-success-primary/20 border border-success-primary/50 text-success-primary">
                            <CheckCircle size={24} />
                            <div>
                               <p className="font-semibold">2FA is currently enabled on your account.</p>
                               <p className="text-sm">Your account is protected with an additional security layer.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleUnenrollRequest}
                            disabled={isLoading}
                            className="mt-4 px-5 py-2 rounded-lg bg-danger-primary/80 text-content-inverted hover:bg-danger-primary transition text-sm font-semibold disabled:bg-background-interactive"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : 'Disable 2FA'}
                        </button>
                    </div>
                ) : qrCode ? (
                    <div className="space-y-4">
                        <div>
                            <p className="font-semibold text-content-primary mb-2">1. Scan this QR code with your authenticator app</p>
                            <div className="bg-white p-4 rounded-lg inline-block border-4 border-white">
                               <img src={qrCode} alt="2FA QR Code" />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-content-primary mb-2">2. Enter the verification code</p>
                            <div className="flex flex-wrap items-center gap-3">
                                 <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    inputMode="numeric"
                                    className="w-48 bg-background-interactive border border-border-secondary rounded-lg p-2 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition tracking-widest"
                                />
                                <button
                                    onClick={handleChallengeAndVerify}
                                    disabled={isLoading || verificationCode.length !== 6}
                                    className="px-5 py-2 rounded-lg bg-accent-primary text-accent-primary-text hover:bg-accent-primary-hover transition text-sm font-semibold disabled:bg-background-interactive"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Verify & Enable'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={handleEnroll}
                        disabled={isLoading}
                        className="px-5 py-2 rounded-lg bg-accent-primary text-accent-primary-text hover:bg-accent-primary-hover transition text-sm font-semibold flex items-center gap-2 disabled:bg-background-interactive"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <QrCode size={18}/>}
                        Enable 2FA
                    </button>
                )}
            </>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-fast" onClick={onClose}>
            <div className="bg-background-tertiary rounded-xl shadow-2xl p-8 w-full max-w-3xl border border-border-primary m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-content-primary">Account Settings</h2>
                        <p className="text-content-muted text-sm">{userEmail}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors"><X size={24} /></button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 -mr-4">
                    <div className="space-y-6">
                        <ThemeSwitcher />
                        <div className="bg-background-primary/50 p-6 rounded-xl border border-border-primary">
                            <h2 className="text-xl font-semibold mb-2 text-content-primary flex items-center gap-2"><Shield />Two-Factor Authentication (2FA)</h2>
                            <p className="text-sm text-content-muted mb-6">
                                Add an extra layer of security to your account. When enabled, you'll be required to enter a code from your authenticator app to log in.
                            </p>
                            {render2FAContent()}
                        </div>
                         <div className="bg-background-primary/50 p-6 rounded-xl border border-border-primary">
                            <h2 className="text-xl font-semibold mb-4 text-content-primary flex items-center gap-2"><Keyboard />Keyboard Shortcuts</h2>
                            <ShortcutsList />
                        </div>
                    </div>
                </div>
            </div>
             <style>{`
                @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AccountModal;