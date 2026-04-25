import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Toast, useToast } from "./Toast";

export function PlanSelection() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<"freemium" | "basic" | "pro" | "ultra">("freemium");
    const [currentInterval, setCurrentInterval] = useState<"month" | "year" | null>(null);
    const [interval, setInterval] = useState<"month" | "year">("month");
    const { toast, show: showToast, hide: hideToast } = useToast();
    const [hasHistory, setHasHistory] = useState(false);

    useEffect(() => {
        const sessionId = searchParams.get("session_id");
        const canceled = searchParams.get("canceled");

        if (sessionId) {
            verifySession(sessionId);
        } else if (canceled) {
            showToast("Subscription not completed.", "error");
            fetchCurrentPlan();
        } else {
            fetchCurrentPlan();
        }
        checkHistory();
    }, [searchParams]);

    const fetchCurrentPlan = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/billing/plan", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentPlan(data.plan_type || "freemium");
                setCurrentInterval(data.interval || "month");
                if (data.interval === "year") setInterval("year");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const checkHistory = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/billing/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHasHistory(Array.isArray(data) && data.length > 0);
            }
        } catch (err) {
            // Ignore error, button stays hidden
        }
    };

    const verifySession = async (sessionId: string) => {
        setVerifying(true);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`/api/billing/verify-session?session_id=${sessionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.status === "success") {
                    const planName = data.plan_type.charAt(0).toUpperCase() + data.plan_type.slice(1);
                    showToast(`Subscription activated successfully! You've been upgraded to the ${planName} plan.`);
                    setCurrentPlan(data.plan_type as any);
                    fetchCurrentPlan();
                } else {
                    showToast("Payment verification pending or failed. Please refresh later.", "error");
                    fetchCurrentPlan();
                }
            } else {
                fetchCurrentPlan();
            }
        } catch (err) {
            fetchCurrentPlan();
            showToast("Could not verify your newly created subscription.", "error");
        } finally {
            setVerifying(false);
            // Replace the URL to strip the session_id so the back button
            // doesn't re-land on the Stripe redirect URL and re-trigger verification.
            navigate("/plan", { replace: true });
        }
    };

    const handleSubscribePrompt = async (planId: string) => {
        if (currentPlan === planId) {
            return;
        }

        setLoadingPlanId(planId);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/billing/create-checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ plan_id: planId, interval })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    // New subscriber — redirect to Stripe Checkout
                    window.location.href = data.url;
                } else if (data.status === "modified") {
                    // Existing subscriber — plan changed in-place with proration
                    const planOrder: Record<string, number> = { freemium: 0, basic: 1, pro: 2, ultra: 3 };
                    const tierLower = planOrder[planId] < planOrder[currentPlan];
                    const goingToAnnual = interval === "year" && currentInterval === "month";
                    const goingToMonthly = interval === "month" && currentInterval === "year";
                    // Switching to annual = upgrade; switching to monthly = downgrade; else compare tier
                    const isDowngrade = goingToAnnual ? false : goingToMonthly ? true : tierLower;
                    const planName = data.plan_type.charAt(0).toUpperCase() + data.plan_type.slice(1);
                    showToast(
                        isDowngrade
                            ? `Downgraded to ${planName}. Your remaining credit has been applied as a proration.`
                            : `Upgraded to ${planName}! You've only been charged for the remaining days in your billing cycle.`
                    );
                    setCurrentPlan(data.plan_type as any);
                    setLoadingPlanId(null);
                } else {
                    throw new Error("Unexpected response from billing service");
                }
            } else {
                throw new Error("Could not process plan change");
            }
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to change plan", "error");
            setLoadingPlanId(null);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#F0F4F8] transition-colors duration-300 overflow-hidden relative">
            <Toast toast={toast} onClose={hideToast} />

            <div className="w-full max-w-7xl mx-auto px-4 pt-8 pb-4 sm:px-6 lg:px-8 flex flex-col h-full">
                {/* Back button — absolutely positioned so it never pushes the heading */}
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => navigate("/")}
                        title="Back"
                        className="p-2 border border-[#E2E8F0] rounded-[10px] text-[#64748B] hover:text-[#00386B] hover:border-[#00386B] transition-colors shrink-0"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    {hasHistory && (
                        <button
                            onClick={() => navigate("/billing/history")}
                            className="px-4 py-2 bg-[#FFC20E] border-none rounded-[10px] text-[13px] font-[700] text-[#00386B] hover:bg-[#E6AE00] transition-all shrink-0 shadow-[0_2px_8px_rgba(255,194,14,0.3)]"
                        >
                            Purchase History
                        </button>
                    )}
                </div>
                {/* Heading — full-width centered, independent of side controls */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-[700] text-[#00386B] mb-1">
                        Select your plan
                    </h1>
                    <p className="text-[#64748B] text-[15px]">
                        Upgrade to unlock expanded capabilities and longer chat sessions.
                    </p>
                </div>

                {verifying && (
                    <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 rounded-lg text-sm font-medium flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-800 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying your payment...
                    </div>
                )}

                {/* Billing Interval Toggle */}
                <div className="flex justify-center mb-3">
                    <div className="relative flex rounded-full bg-[#F1F5F9] p-1 shadow-inner">
                        <button
                            onClick={() => setInterval("month")}
                            className={`relative rounded-full px-6 py-2.5 text-sm transition-all duration-200 ${interval === "month"
                                ? "bg-white text-[#00386B] font-[700] shadow-sm"
                                : "text-[#64748B] font-[500] hover:text-[#00386B]"
                                }`}
                        >
                            Monthly billing
                        </button>
                        <button
                            onClick={() => setInterval("year")}
                            className={`relative rounded-full px-6 py-2.5 text-sm transition-all duration-200 ${interval === "year"
                                ? "bg-white text-[#00386B] font-[700] shadow-sm"
                                : "text-[#64748B] font-[500] hover:text-[#00386B]"
                                }`}
                        >
                            Annual billing
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex items-center">
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch">

                    {/* FREEMIUM CARD */}
                    <div className={`relative flex flex-col rounded-[16px] p-6 transition-all duration-300 ${currentPlan === "freemium" ? "bg-white border-2 border-[#00386B] shadow-xl" : "bg-white border border-[#E2E8F0] shadow-sm"}`}>
                        <div className="mb-4">
                            <h2 className="text-[20px] font-[700] text-[#1E293B]">Go</h2>
                            <div className="mt-4 flex items-baseline text-4xl font-[800] text-[#00386B]">
                                $0
                                <div className="ml-2 flex flex-row gap-1 text-[14px] font-[500] text-[#64748B]">
                                    <span>USD /</span>
                                    <span>month</span>
                                </div>
                            </div>
                            <p className="mt-4 text-[14px] font-[500] text-[#334155]">
                                Keep chatting with expanded access
                            </p>
                        </div>
                        <div className="my-3 pt-3 border-t border-gray-100">
                            <ul className="space-y-4">
                                <li className="flex items-start">
                                    <svg className="shrink-0 h-5 w-5 text-[#CBD5E1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    <span className="ml-3 text-[14px] text-[#94A3B8]">Explore topics in depth</span>
                                </li>
                            </ul>
                        </div>
                        <div className="mt-auto pt-[88px] w-full">
                            {currentPlan === "freemium" ? (
                                <button disabled className="block w-full rounded-[10px] bg-[#F1F5F9] px-6 py-3 text-center text-sm font-[700] text-[#94A3B8] cursor-not-allowed">Your current plan</button>
                            ) : (
                                <button disabled className="block w-full rounded-[10px] border-[1.5px] border-[#CBD5E1] bg-transparent px-6 py-3 text-center text-sm font-[600] text-[#334155] hover:bg-[#F1F5F9] transition-colors">Downgrade to Go</button>
                            )}
                        </div>
                    </div>

                    {[
                        {
                            id: "basic", name: "Basic", priceMo: 1, priceYr: 10,
                            colorClasses: {
                                borderActive: "border-[#00386B]",
                                textSubtitle: "text-[#2B93D1]",
                                icon: "text-[#059669]",
                                btnCurrentBg: "bg-[#F1F5F9]",
                                btnCurrentText: "text-[#94A3B8]",
                                btnUpgradeBg: "bg-[#FFC20E] text-[#00386B] hover:bg-[#E6AE00]"
                            }
                        },
                        {
                            id: "pro", name: "Pro", priceMo: 2, priceYr: 20,
                            colorClasses: {
                                borderActive: "border-[#00386B]",
                                textSubtitle: "text-[#2B93D1]",
                                icon: "text-[#059669]",
                                btnCurrentBg: "bg-[#F1F5F9]",
                                btnCurrentText: "text-[#94A3B8]",
                                btnUpgradeBg: "bg-[#FFC20E] text-[#00386B] hover:bg-[#E6AE00]"
                            }
                        },
                        {
                            id: "ultra", name: "Ultra", priceMo: 3, priceYr: 30,
                            colorClasses: {
                                borderActive: "border-[#00386B]",
                                textSubtitle: "text-[#2B93D1]",
                                icon: "text-[#059669]",
                                btnCurrentBg: "bg-[#F1F5F9]",
                                btnCurrentText: "text-[#94A3B8]",
                                btnUpgradeBg: "bg-[#FFC20E] text-[#00386B] hover:bg-[#E6AE00]"
                            }
                        }
                    ].map((plan) => {
                        const isSamePlanAnnualToMonthly = currentPlan === plan.id && currentInterval === "year" && interval === "month";
                        const planOrder: Record<string, number> = { freemium: 0, basic: 1, pro: 2, ultra: 3 };
                        const tierLower = planOrder[plan.id] < planOrder[currentPlan];
                        const tierHigher = planOrder[plan.id] > planOrder[currentPlan];
                        const goingToAnnual = interval === "year" && currentInterval === "month";
                        const goingToMonthly = interval === "month" && currentInterval === "year";
                        
                        let isDowngrade = false;
                        let isUpgrade = false;
                        
                        if (currentPlan === plan.id) {
                            if (goingToAnnual) isUpgrade = true;
                            if (goingToMonthly) isDowngrade = true;
                        } else {
                            if (tierLower) isDowngrade = true;
                            if (tierHigher) isUpgrade = true;
                        }

                        let dynamicBtnClass = "";
                        if (isUpgrade) {
                            dynamicBtnClass = "bg-[#059669] text-white border-none shadow-[0_2px_8px_rgba(5,150,105,0.3)] hover:bg-[#047857]";
                        } else {
                            dynamicBtnClass = "bg-transparent border-[1.5px] border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9]";
                        }

                        return (
                        <div key={plan.id} className={`relative flex flex-col rounded-[16px] p-6 transition-all duration-300 ${currentPlan === plan.id ? `bg-white shadow-xl border-2 ${plan.colorClasses.borderActive}` : "bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md"}`}>
                            <div className="mb-4">
                                <h2 className="text-[20px] font-[700] text-[#1E293B]">{plan.name}</h2>
                                <div className="mt-4 flex items-baseline text-4xl font-[800] text-[#00386B]">
                                    ${interval === "month" ? plan.priceMo : plan.priceYr}
                                    <div className="ml-2 flex flex-row gap-1 text-[14px] font-[500] text-[#64748B]">
                                        <span>USD /</span>
                                        <span>{interval === "month" ? "month" : "year"}</span>
                                    </div>
                                </div>
                                <p className={`mt-4 text-[14px] font-[500] ${plan.colorClasses.textSubtitle}`}>
                                    Billed {interval === "month" ? "monthly" : "annually"}
                                </p>
                            </div>
                            <div className="my-3 pt-3 border-t border-gray-100">
                                <ul className="space-y-4">
                                    <li className="flex items-start">
                                        <svg className={`shrink-0 h-5 w-5 ${plan.colorClasses.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        <span className="ml-3 text-[14px] text-[#334155]">All Go features</span>
                                    </li>
                                    <li className="flex items-start">
                                        <svg className={`shrink-0 h-5 w-5 ${plan.colorClasses.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        <span className="ml-3 text-[14px] text-[#334155]">{plan.name} level capabilities</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-auto pt-[88px] w-full">
                                {currentPlan === plan.id && (currentInterval === null || currentInterval === interval) ? (
                                    <button disabled className={`block w-full rounded-[10px] border-none ${plan.colorClasses.btnCurrentBg} px-4 py-3 text-center text-sm font-[700] ${plan.colorClasses.btnCurrentText} cursor-not-allowed whitespace-nowrap`}>Your current plan</button>
                                ) : (
                                    <button onClick={() => handleSubscribePrompt(plan.id)} disabled={loadingPlanId !== null || isSamePlanAnnualToMonthly} className={`block w-full rounded-[10px] px-4 py-3 text-center text-sm font-[700] transition-all disabled:cursor-not-allowed whitespace-nowrap ${dynamicBtnClass} ${isSamePlanAnnualToMonthly ? "opacity-50" : ""}`}>
                                    {loadingPlanId === plan.id ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Redirecting...
                                        </div>
                                    ) : (
                                        (() => {
                                            if (currentPlan === plan.id) {
                                                if (isSamePlanAnnualToMonthly) return "Unavailable on Monthly";
                                                return interval === "year" ? "Upgrade to Annual" : "Switch to Monthly";
                                            }
                                            return isDowngrade ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`;
                                        })()
                                    )}
                                </button>
                            )}
                            </div>
                        </div>
                    )})}
                </div>
                </div>

                <div className="mt-4 text-center text-[13px] text-[#94A3B8] pb-2">
                    Pricing and payments are securely handled via Stripe checkout.
                </div>
            </div>
        </div>
    );
}
