import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface TrialStatus {
    plan_type: string;
    is_admin: boolean;
    created_at: string | null;
}

export function TrialModal() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<TrialStatus | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [daysLeft, setDaysLeft] = useState<number>(0);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const token = localStorage.getItem("auth_token");
                if (!token) return;

                const res = await fetch("/api/auth/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);

                    if (data.plan_type === "freemium" && data.created_at) {
                        const created = new Date(data.created_at);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - created.getTime());
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        const remaining = 7 - diffDays;
                        const isExp = remaining <= 0;
                        setDaysLeft(remaining > 0 ? remaining : 0);
                        setIsExpired(isExp);
                        
                        if (isExp) {
                            setIsOpen(true);
                        } else {
                            const today = new Date().toDateString();
                            const lastSeen = localStorage.getItem("lastTrialWarningDate");
                            if (lastSeen !== today) {
                                setIsOpen(true);
                                localStorage.setItem("lastTrialWarningDate", today);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch trial status", err);
            }
        };

        fetchStatus();
    }, []);

    if (!status || status.is_admin || status.plan_type !== "freemium" || !status.created_at) {
        return null;
    }

    const handleClose = () => {
        if (!isExpired) {
            setIsOpen(false);
        }
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" aria-hidden="true" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-[var(--color-bg-card)] px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-8 border border-[#d0dce8]">
                                {!isExpired && (
                                    <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                        <button
                                            type="button"
                                            className="rounded-md bg-transparent focus:outline-none" style={{ color: 'var(--color-text-light)' }}
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <span className="sr-only">Close</span>
                                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                                <div>
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(0,56,107,0.1)' }}>
                                        <svg className="h-8 w-8" style={{ color: 'var(--color-secondary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="mt-5 text-center sm:mt-6">
                                        <Dialog.Title as="h3" className="text-2xl font-bold leading-6 mb-2" style={{ color: 'var(--color-primary)' }}>
                                            {isExpired ? "Free trial expired" : `${daysLeft} days left in trial`}
                                        </Dialog.Title>
                                        <div className="mt-3">
                                            <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>
                                                {isExpired
                                                    ? "Your 7-day free trial has expired. To continue using the application, you must purchase a subscription."
                                                    : "You're currently enjoying your 7-day free trial. Purchase a subscription anytime to ensure uninterrupted access."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 sm:flex sm:flex-col gap-3">
                                    <button
                                        type="button"
                                        className="w-full py-3 rounded-md text-sm font-semibold shadow-sm transition-colors focus:outline-none disabled:opacity-50"
                                        style={{ backgroundColor: '#FFC20E', color: '#00386B' }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E6AE00')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFC20E')}
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate("/plan");
                                        }}
                                    >
                                        Buy a subscription
                                    </button>
                                    {isExpired && (
                                        <p className="mt-2 text-xs text-center text-gray-400 dark:text-gray-500">
                                            Chat is disabled until a plan is selected.
                                        </p>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
