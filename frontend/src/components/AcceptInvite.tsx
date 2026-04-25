import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PasswordInput } from "./PasswordInput";
import { Button } from "./Button";

export function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const hasFetched = useRef(false);

    // State for password setup layer
    const [password, setPassword] = useState("");
    const [pwdStatus, setPwdStatus] = useState<"idle" | "loading" | "error">("idle");
    const [pwdError, setPwdError] = useState("");

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const token = searchParams.get("token");
        if (!token) {
            setStatus("error");
            setErrorMsg("No invite token found in the URL.");
            return;
        }

        fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.detail || "Invalid or expired invite link.");
                }
                return res.json();
            })
            .then((data) => {
                localStorage.setItem("auth_token", data.access_token);
                // Instead of success => redirect, go into "set-password" state
                setStatus("success");
            })
            .catch((err) => {
                setStatus("error");
                setErrorMsg(err.message || "Something went wrong.");
            });
    }, [searchParams]);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setPwdStatus("error");
            setPwdError("Password must be at least 6 characters.");
            return;
        }

        setPwdStatus("loading");
        const token = localStorage.getItem("auth_token");
        try {
            const res = await fetch("/api/auth/set-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ new_password: password })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to set password.");
            }

            // Password set successfully, head to app
            navigate("/", { replace: true });
        } catch (err: unknown) {
            setPwdStatus("error");
            setPwdError(err instanceof Error ? err.message : "Something went wrong.");
        }
    };

    const handleSkip = () => {
        navigate("/", { replace: true });
    };

    const inputClass = `w-full rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all
        bg-gray-100 border border-gray-200 focus:bg-white dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-[#555] dark:focus:bg-transparent`;

    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-[#171717]">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#212121] border border-gray-200 dark:border-[#3a3a3a] shadow-xl p-10 text-center">

                {status === "loading" && (
                    <>
                        <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-[#00386B]/10 dark:bg-[#00386B]/30 flex items-center justify-center">
                            <svg className="h-6 w-6 animate-spin text-[#00386B] dark:text-[#2B93D1]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Accepting invite…</h2>
                        <p className="text-sm text-gray-500 dark:text-[#8e8ea0]">Hang tight while we set up your account.</p>
                    </>
                )}

                {status === "success" && (
                    <div className="text-left">
                        <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Invite Accepted!</h2>
                        <p className="text-sm text-center text-gray-500 dark:text-[#8e8ea0] mb-6">
                            You're successfully logged in. Would you like to set a password for your account now?
                        </p>

                        <form onSubmit={handleSetPassword} className="space-y-4">
                            {pwdStatus === "error" && (
                                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-[#fca5a5]">
                                    {pwdError}
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8e8ea0]">Optional Password</label>
                                <PasswordInput
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={inputClass}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="pt-2 flex flex-col gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleSkip}
                                    disabled={pwdStatus === "loading"}
                                    className="w-full py-3"
                                >
                                    Skip for now
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={pwdStatus === "loading"}
                                    className="w-full py-3"
                                >
                                    {pwdStatus === "loading" ? "Saving…" : "Save Password & Continue"}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {status === "error" && (
                    <>
                        <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Invite link invalid</h2>
                        <p className="text-sm text-gray-500 dark:text-[#8e8ea0] mb-6">{errorMsg}</p>
                        <a
                            href="/login"
                            className="inline-block px-6 py-3 rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] text-[#00386B] text-sm font-[600] transition-colors"
                        >
                            Back to Login
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
