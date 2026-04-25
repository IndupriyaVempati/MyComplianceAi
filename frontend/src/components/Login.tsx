import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "./ThemeProvider";
import { PasswordInput } from "./PasswordInput";

interface LoginProps {
    isAdminLogin?: boolean;
}

type Screen = "login" | "forgot-email" | "forgot-otp" | "login-otp-email" | "login-otp-verify";

export function Login({ isAdminLogin = false }: LoginProps) {
    const [screen, setScreen] = useState<Screen>("login");

    // Login form state
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Forgot-password & OTP state
    const [fpEmail, setFpEmail] = useState("");
    const [fpOtp, setFpOtp] = useState("");
    const [fpNewPassword, setFpNewPassword] = useState("");
    const [fpError, setFpError] = useState<string | null>(null);
    const [fpLoading, setFpLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Auto-dismiss success message after 3s
    useEffect(() => {
        if (!successMsg) return;
        const t = setTimeout(() => setSuccessMsg(null), 3000);
        return () => clearTimeout(t);
    }, [successMsg]);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [resendCooldown]);

    const { theme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const accentColor = "#2B93D1";


    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const resp = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            if (!resp.ok) {
                const data = await resp.clone().json().catch(() => ({}));
                throw new Error(data.detail || "Invalid username or password");
            }
            const { access_token } = await resp.json();
            localStorage.setItem("auth_token", access_token);
            const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
            navigate(from || (isAdminLogin ? "/admin" : "/"), { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotEmailSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFpLoading(true);
        setFpError(null);
        try {
            const resp = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: fpEmail }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to send OTP");
            }
            setScreen("forgot-otp");
            setResendCooldown(60);
        } catch (err: unknown) {
            setFpError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setFpLoading(false);
        }
    };

    const handleOTPSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFpLoading(true);
        setFpError(null);
        try {
            const resp = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: fpEmail, otp: fpOtp, new_password: fpNewPassword }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.detail || "Invalid or expired OTP");
            }
            setFpEmail(""); setFpOtp(""); setFpNewPassword("");
            setScreen("login");
            setSuccessMsg("Password reset successfully. You can now sign in.");
        } catch (err: unknown) {
            setFpError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setFpLoading(false);
        }
    };

    const handleLoginOtpEmailSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFpLoading(true);
        setFpError(null);
        try {
            const resp = await fetch("/api/auth/login-otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: fpEmail }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to send login code");
            }
            setScreen("login-otp-verify");
            setResendCooldown(60);
        } catch (err: unknown) {
            setFpError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setFpLoading(false);
        }
    };

    const handleLoginOtpVerifySubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFpLoading(true);
        setFpError(null);
        try {
            const resp = await fetch("/api/auth/login-otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: fpEmail, otp: fpOtp, new_password: "dummy_password" }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.detail || "Invalid or expired code");
            }
            const { access_token } = await resp.json();
            localStorage.setItem("auth_token", access_token);
            const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
            navigate(from || (isAdminLogin ? "/admin" : "/"), { replace: true });
        } catch (err: unknown) {
            setFpError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setFpLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (resendCooldown > 0) return;
        setFpLoading(true);
        setFpError(null);
        try {
            const endpoint = screen === "forgot-otp" ? "/api/auth/forgot-password" : "/api/auth/login-otp/request";
            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: fpEmail }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to resend code");
            }
            setResendCooldown(60);
            setSuccessMsg("Code resent successfully"); // Optional, or handle silently
        } catch (err: unknown) {
            setFpError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setFpLoading(false);
        }
    };

    const inputClass = `w-full bg-[#FFFFFF] border-[1.5px] border-[#CBD5E1] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] placeholder-[#94A3B8] outline-none transition-all
        focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15`;
    const blurStyle = { borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "#e5e7eb" };

    return (
        <div
            className="relative flex h-screen w-full overflow-hidden transition-colors duration-500 bg-[#F0F4F8]"
        >


            <div className="relative z-10 m-auto w-full max-w-md px-4">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="mb-5 flex items-center justify-center">
                        <img src="/Surtn_Logo.png" alt="Surtn Logo" className="h-16 object-contain drop-shadow-xl" />
                    </div>
                    <h1 className="text-[28px] font-[700] text-[#00386B]">
                        {isAdminLogin ? "Surtn - the AI Assistant" : "Surtn - the AI Assistant"}
                    </h1>
                    <p className="mt-2 text-[15px] text-[#64748B]">
                        {screen === "login"
                            ? (isAdminLogin ? "Restricted access — admins only" : "Sign in to your account")
                            : screen === "forgot-email"
                                ? "Enter your email address"
                                : screen === "forgot-otp"
                                    ? "Enter your code"
                                    : screen === "login-otp-email"
                                        ? "Sign in with a code"
                                        : "Enter login code"}
                    </p>
                </div>

                {/* Glass card */}
                <div className="rounded-[16px] p-8 transition-all duration-500 bg-[#FFFFFF] shadow-[0_8px_24px_rgba(0,0,0,0.10)] dark:bg-white/5 dark:border-white/10 dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)]">

                    {/* ── SCREEN 1: Login ── */}
                    {screen === "login" && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            {successMsg && (
                                <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-900/30 dark:text-green-300">
                                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {successMsg}
                                </div>
                            )}
                            {error && (
                                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">
                                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-[#64748B]">Email / Username</label>
                                <input id="username" type="text" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your email or username" className={inputClass} />
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[#64748B]">Password</label>
                                    <button type="button" onClick={() => { setScreen("forgot-email"); setFpError(null); }} className="text-[13px] font-[500] text-[#2B93D1] hover:text-[#00386B] transition-colors">
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <input id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className={`${inputClass} pr-12`} />
                                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#2B93D1]" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                                        {showPassword ? (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={isLoading} className="relative mt-2 w-full overflow-hidden rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] py-3 text-[15px] font-[700] text-[#00386B] transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] disabled:opacity-50">
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Signing in…
                                    </span>
                                ) : "Sign In"}
                            </button>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-[#E2E8F0] dark:border-white/10"></div>
                                <span className="flex-shrink-0 mx-4 text-[13px] text-[#94A3B8]">Or</span>
                                <div className="flex-grow border-t border-[#E2E8F0] dark:border-white/10"></div>
                            </div>

                            <button type="button" onClick={() => { setScreen("login-otp-email"); setFpError(null); }} className="w-full rounded-[10px] py-3 text-[14px] font-[600] transition-all bg-transparent hover:bg-[#2B93D1]/10 text-[#2B93D1] border-[1.5px] border-[#2B93D1]">
                                Sign in with Email Code
                            </button>
                        </form>
                    )}

                    {/* ── SCREEN 2: Enter email for Reset OTP ── */}
                    {screen === "forgot-email" && (
                        <form onSubmit={handleForgotEmailSubmit} className="space-y-5">
                            {fpError && (
                                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">{fpError}</div>
                            )}
                            <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
                                Enter your email address and we'll send you a{" "}
                                <span className="whitespace-nowrap">6-digit code</span> to reset your password.
                            </p>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">Email</label>
                                <input type="email" required value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
                            </div>
                            <button type="submit" disabled={fpLoading} className="w-full rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] py-3 text-[15px] font-[700] text-[#00386B] transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] disabled:opacity-50">
                                {fpLoading ? "Sending…" : "Send Code"}
                            </button>
                            <button type="button" onClick={() => setScreen("login")} className="w-full text-sm text-center text-gray-500 hover:text-gray-700 dark:text-[#8e8ea0] dark:hover:text-[#ececec] transition-colors">
                                ← Back to sign in
                            </button>
                        </form>
                    )}

                    {/* ── SCREEN 3: Enter OTP + new password ── */}
                    {screen === "forgot-otp" && (
                        <form onSubmit={handleOTPSubmit} className="space-y-5">
                            {fpError && (
                                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">{fpError}</div>
                            )}
                            <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
                                We sent a 6-digit code to <strong>{fpEmail}</strong>. Enter it below along with your new password.
                            </p>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">Reset Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} required value={fpOtp} onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={`${inputClass} tracking-[0.4em] text-center text-lg font-bold`} onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)} onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)} />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">New Password</label>
                                <PasswordInput
                                    value={fpNewPassword}
                                    onChange={(e) => setFpNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={inputClass}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                                    onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
                                />
                            </div>
                            <button type="submit" disabled={fpLoading} className="w-full rounded-[10px] bg-[#00386B] py-3 text-[15px] font-[700] text-white transition-all hover:bg-[#00295A] shadow-[0_2px_8px_rgba(0,56,107,0.2)] disabled:opacity-50">
                                {fpLoading ? "Resetting…" : "Reset Password"}
                            </button>
                            <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0 || fpLoading} className="w-full text-sm text-center text-gray-500 hover:text-gray-700 dark:text-[#8e8ea0] dark:hover:text-[#ececec] transition-colors disabled:opacity-50 disabled:hover:text-gray-500 dark:disabled:hover:text-[#8e8ea0]">
                                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                            </button>
                        </form>
                    )}

                    {/* ── SCREEN 4: Enter email for Login OTP ── */}
                    {screen === "login-otp-email" && (
                        <form onSubmit={handleLoginOtpEmailSubmit} className="space-y-5">
                            {fpError && (
                                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">{fpError}</div>
                            )}
                            <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
                                No password? No problem. We'll email you a{" "}
                                <span className="whitespace-nowrap">6-digit code</span> to log in instantly.
                            </p>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">Email</label>
                                <input type="email" required value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
                            </div>
                            <button type="submit" disabled={fpLoading} className="w-full rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] py-3 text-[15px] font-[700] text-[#00386B] transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] disabled:opacity-50">
                                {fpLoading ? "Sending…" : "Send Code"}
                            </button>
                            <button type="button" onClick={() => setScreen("login")} className="w-full text-sm text-center text-gray-500 hover:text-gray-700 dark:text-[#8e8ea0] dark:hover:text-[#ececec] transition-colors">
                                ← Back to sign in
                            </button>
                        </form>
                    )}

                    {/* ── SCREEN 5: Verify Login OTP ── */}
                    {screen === "login-otp-verify" && (
                        <form onSubmit={handleLoginOtpVerifySubmit} className="space-y-5">
                            {fpError && (
                                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">{fpError}</div>
                            )}
                            <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
                                We sent a 6-digit login code to <strong>{fpEmail}</strong>. Enter it below to sign in.
                            </p>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">Login Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} required value={fpOtp} onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={`${inputClass} tracking-[0.4em] text-center text-lg font-bold`} autoFocus onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)} onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)} />
                            </div>
                            <button type="submit" disabled={fpLoading} className="w-full rounded-[10px] bg-[#00386B] py-3 text-[15px] font-[700] text-white transition-all hover:bg-[#00295A] shadow-[0_2px_8px_rgba(0,56,107,0.2)] disabled:opacity-50">
                                {fpLoading ? "Signing in…" : "Sign In"}
                            </button>
                            <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0 || fpLoading} className="w-full text-sm text-center text-gray-500 hover:text-gray-700 dark:text-[#8e8ea0] dark:hover:text-[#ececec] transition-colors disabled:opacity-50 disabled:hover:text-gray-500 dark:disabled:hover:text-[#8e8ea0]">
                                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                            </button>
                        </form>
                    )}
                </div>

                <p className="mt-6 text-center text-[13px] text-[#94A3B8]">
                    {isAdminLogin ? "For support, contact your system administrator." : "Contact your admin if you need access."}
                </p>
            </div>
        </div>
    );
}
