import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { PasswordInput } from "./PasswordInput";


export function UserSettingsModal({
    isOpen,
    onClose,
    admin,
}: {
    isOpen: boolean;
    onClose: () => void;
    admin?: boolean;
}) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [form, setForm] = useState({
        name: "",
        username: "",
        password: ""
    });
    const [originalName, setOriginalName] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
            setMessage(null);
            setForm(f => ({ ...f, password: "" }));
            setOriginalName("");
        }
    }, [isOpen]);

    // Auto-dismiss message after 3 seconds
    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [message]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const resp = await fetch("/api/auth/me", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setForm({
                    name: data.name || "",
                    username: data.username || "",
                    password: "" // Keep password blank
                });
                setOriginalName(data.name || "");
            } else {
                throw new Error("Could not load profile");
            }
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error loading profile" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const token = localStorage.getItem("auth_token");
            const payload: Record<string, string> = {
                name: form.name,
                username: form.username,
            };
            if (form.password) {
                payload.password = form.password;
            }

            const resp = await fetch("/api/auth/me", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const d = await resp.json();
                throw new Error(d.detail || "Failed to update profile");
            }

            setMessage({ type: "success", text: "Profile updated successfully!" });
            setOriginalName(form.name); // update baseline after successful save
            setForm(f => ({ ...f, password: "" })); // clear password after save
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error saving profile" });
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "w-full border-[1.5px] border-[#CBD5E1] rounded-[10px] px-[14px] py-[10px] text-[14px] text-[#1E293B] bg-white placeholder-[#94A3B8] outline-none transition-all focus:border-[#2B93D1] focus:ring-2 focus:ring-[#2B93D1]/15 leading-relaxed";
    const readonlyClass = "w-full border-[1.5px] border-dashed border-[#E2E8F0] rounded-[10px] px-[14px] py-[10px] text-[14px] text-[#94A3B8] bg-[#F8FAFC] cursor-not-allowed select-none transition-all";
    const labelClass = "block text-[13px] font-[600] text-[#334155] mb-1.5";

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel 
                                className="relative transform overflow-hidden rounded-[16px] bg-white text-left transition-all sm:my-8 sm:w-full sm:max-w-md border-none"
                                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                            >
                                <form onSubmit={handleSave}>
                                    <div className="px-6 py-5 flex items-center justify-between">
                                        <Dialog.Title as="h3" style={{ color: '#00386B', fontSize: '20px', fontWeight: '700' }}>
                                            Profile
                                        </Dialog.Title>
                                        <button
                                            type="button"
                                            className="transition-colors"
                                            style={{ color: '#94A3B8' }}
                                            onMouseOver={(e) => e.currentTarget.style.color = '#00386B'}
                                            onMouseOut={(e) => e.currentTarget.style.color = '#94A3B8'}
                                            onClick={onClose}
                                        >
                                            <span className="sr-only">Close</span>
                                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                        </button>
                                    </div>

                                    <div className="px-6 py-5">
                                        {message && (
                                            <div className={`mb-5 p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-900/30' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/30'}`}>
                                                {message.text}
                                            </div>
                                        )}

                                        {loading ? (
                                            <div className="flex justify-center py-8">
                                                <svg className="h-8 w-8 animate-spin text-[#2B93D1]" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className={labelClass}>Name</label>
                                                        <input
                                                            type="text"
                                                            value={form.name}
                                                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                                            className={inputClass}
                                                            placeholder="Your Name"
                                                            style={{ fontFamily: 'Poppins' }}
                                                        />
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <label className={labelClass}>Email / Username</label>
                                                        <span className="bg-[#F1F5F9] text-[#64748B] text-[10px] font-[700] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full">Read-only</span>
                                                    </div>
                                                    <input
                                                        type="email"
                                                        value={form.username}
                                                        readOnly
                                                        className={readonlyClass}
                                                    />
                                                </div>

                                                <div className="pt-2">
                                                    <label className={labelClass}>Update Password</label>
                                                    <PasswordInput
                                                        value={form.password}
                                                        onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                                                        className={inputClass}
                                                        placeholder="Leave blank to keep current password"
                                                        autoComplete="new-password"
                                                    />
                                                    <p className="mt-1.5 text-[12px] text-[#64748B]">
                                                        Enter a new password if you wish to change it.
                                                    </p>
                                                </div>
                                                {!admin && (
                                                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-[#2a2a2a]">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <label className={labelClass}>Subscription Plan</label>
                                                                <p className="text-[12px] text-[#64748B]">Manage your active billing plan.</p>
                                                            </div>
                                                            <Link
                                                                to="/plan"
                                                                onClick={onClose}
                                                                className="px-3 py-1.5 rounded-[10px] text-[14px] font-[600] transition-colors"
                                                                style={{ 
                                                                    border: '2px solid #2B93D1',
                                                                    color: '#2B93D1'
                                                                }}
                                                                onMouseOver={(e) => {
                                                                    e.currentTarget.style.backgroundColor = '#2B93D1';
                                                                    e.currentTarget.style.color = '#FFFFFF';
                                                                }}
                                                                onMouseOut={(e) => {
                                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                                    e.currentTarget.style.color = '#2B93D1';
                                                                }}
                                                            >
                                                                Manage Plan
                                                            </Link>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        )}
                                    </div>

                                    <div className="px-6 py-4 bg-gray-50 dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-[#2a2a2a] flex items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            className="flex-1 py-[10px] rounded-[10px] text-[14px] font-[600] transition-colors"
                                            onClick={onClose}
                                            style={{ 
                                                backgroundColor: 'transparent',
                                                color: '#334155',
                                                border: '1.5px solid #CBD5E1'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-[10px] rounded-[10px] text-[14px] font-[700] transition-all disabled:opacity-50 disabled:cursor-not-allowed border-none"
                                            disabled={loading || saving || (form.name === originalName && !form.password)}
                                            style={{ 
                                                backgroundColor: '#059669',
                                                color: '#FFFFFF',
                                                boxShadow: '0 2px 8px rgba(5,150,105,0.3)'
                                            }}
                                            onMouseOver={(e) => {
                                                if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#047857';
                                            }}
                                            onMouseOut={(e) => {
                                                if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#059669';
                                            }}
                                        >
                                            {saving ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
