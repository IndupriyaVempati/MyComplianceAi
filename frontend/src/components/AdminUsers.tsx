import { useState, useEffect } from "react";
import { ConfirmModal } from "./ConfirmModal";

import { useToast } from "./Toast";
import {
    TrashIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface User {
    user_id: string;
    username: string;
    name?: string;
    phone?: string;
    is_admin: boolean;
    created_at: string;
    last_seen?: string | null;
    is_invite_pending?: boolean;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}



// ── Invite Modal ────────────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
    const [emailsText, setEmailsText] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ email: string; error: string }[]>([]);
    const [successes, setSuccesses] = useState<string[]>([]);

    useEffect(() => {
        if (successes.length > 0 || errors.length > 0) {
            const timer = setTimeout(() => {
                setSuccesses([]);
                setErrors([]);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successes, errors]);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const handleSend = async () => {
        const emails = emailsText
            .split(/[\n,]+/)
            .map((e) => e.trim())
            .filter(Boolean);
        if (emails.length === 0) return;

        // Client-side validation
        const invalidEmails = emails.filter((e) => !EMAIL_RE.test(e));
        if (invalidEmails.length > 0) {
            setErrors(invalidEmails.map((e) => ({ email: e, error: "Please enter a valid email address." })));
            return;
        }

        setLoading(true);
        setErrors([]);
        setSuccesses([]);
        try {
            const token = localStorage.getItem("auth_token");
            const resp = await fetch("/api/auth/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ emails }),
            });
            const data = await resp.json();
            const results: { email: string; sent: boolean; error?: string }[] = data.results ?? [];

            const failed = results.filter((r) => !r.sent);
            const succeeded = results.filter((r) => r.sent);

            if (failed.length === 0) {
                const names = succeeded.map((r) => r.email).join(", ");
                onSuccess(`Invitation${succeeded.length > 1 ? "s" : ""} sent to ${names}.`);
                onClose();
            } else {
                setErrors(failed.map((r) => ({ email: r.email, error: r.error ?? "Failed" })));
                setSuccesses(succeeded.map((r) => r.email));
                const sentSet = new Set(succeeded.map((r) => r.email));
                const remaining = emailsText
                    .split(/[\n,]+/)
                    .map((e) => e.trim())
                    .filter((e) => e && !sentSet.has(e))
                    .join("\n");
                setEmailsText(remaining);
            }
        } catch {
            setErrors([{ email: "", error: "Network error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 p-7">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-[#00386B]">Invite to your workspace</h2>
                    <button onClick={onClose} className="text-[#94A3B8] hover:text-[#00386B] transition-colors">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <label className="block text-[13px] font-semibold text-[#334155] mb-2">Email</label>
                <textarea
                    rows={4}
                    value={emailsText}
                    onChange={(e) => { setEmailsText(e.target.value); setErrors([]); }}
                    placeholder="email@example.com, email2@example.com…"
                    className="w-full rounded-[10px] px-3 py-2.5 text-sm bg-white border-[1.5px] border-[#CBD5E1] text-[#1E293B] placeholder-[#94A3B8] focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15 focus:outline-none resize-none transition-all"
                />

                {(successes.length > 0 || errors.length > 0) && (
                    <div className="mt-2 space-y-1.5">
                        {successes.map((email, i) => (
                            <div key={`s-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-green-50 border border-green-200 text-green-700">
                                <span className="font-medium">{email}</span>
                                <span>✓ Sent</span>
                            </div>
                        ))}
                        {errors.map((e, i) => (
                            <div key={`e-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-red-50 border border-red-200 text-red-700">
                                <span className="font-medium">{e.email || "Error"}</span>
                                <span>✗ {e.error}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-center gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium border-[1.5px] border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={loading || !emailsText.trim()}
                        className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-[700] bg-[#00386B] text-[#FFFFFF] hover:bg-[#00295A] disabled:opacity-50 transition-all border-none shadow-[0_2px_8px_rgba(0,56,107,0.3)]"
                    >
                        {loading ? "Sending…" : "Send invites"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function AdminUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const { show: showToast } = useToast();

    // Deletion state
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const token = localStorage.getItem("auth_token");
            const resp = await fetch("/api/auth/admin/users", { headers: { Authorization: `Bearer ${token}` } });
            if (resp.ok) setUsers(await resp.json());
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const deleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            const token = localStorage.getItem("auth_token");
            const resp = await fetch(`/api/auth/admin/users/${userToDelete.user_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!resp.ok) {
                const d = await resp.json();
                throw new Error(d.detail || "Failed to delete user");
            }
            const successText = userToDelete.is_invite_pending
                ? `Invite for ${userToDelete.username} deleted successfully!`
                : `User ${userToDelete.username} deleted successfully!`;
            showToast(successText, "success");
            setUserToDelete(null);
            fetchUsers();
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : "Error deleting user", "error");
        } finally {
            setDeleting(false);
        }
    };

    const thLeft = "px-6 py-4 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-[0.08em] border-b-[2px] border-[#E2E8F0] bg-[#F8FAFC] sticky top-0 z-10 align-middle";
    const thCenter = "px-6 py-4 text-center text-[11px] font-bold text-[#64748B] uppercase tracking-[0.08em] border-b-[2px] border-[#E2E8F0] bg-[#F8FAFC] sticky top-0 z-10 align-middle";
    const tdLeft = "px-6 py-4 whitespace-nowrap text-sm align-middle";
    const tdCenter = "px-6 py-4 whitespace-nowrap text-sm text-center align-middle";

    return (
        <div className="flex flex-col h-full overflow-hidden px-4 md:px-8 py-6 w-full min-w-0 max-w-6xl mx-auto bg-[#F0F4F8]">
            {showInviteModal && <InviteModal
                onClose={() => { setShowInviteModal(false); fetchUsers(); }}
                onSuccess={(msg) => { showToast(msg, "success"); setShowInviteModal(false); fetchUsers(); }}
            />}

            <div className="shrink-0 mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1 text-[#00386B]">User Management</h1>
                    <p className="text-[#64748B]">Manage users and send invites.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchUsers} title="Refresh" className="p-2.5 rounded-[10px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#00386B] transition-all border-[1.5px] border-[#CBD5E1]">
                        <ArrowPathIcon className="h-5 w-5" strokeWidth={2} />
                    </button>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] text-[#00386B] text-sm font-bold transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] border-none"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Invite
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto pb-6">
            {/* Users table */}
            <div className="w-full bg-white rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#E2E8F0] overflow-hidden">

                <div className="w-full overflow-x-auto border-b border-[#F1F5F9]">
                    <table className="min-w-[900px] w-full divide-y divide-gray-200 dark:divide-[#303030]">
                        <thead>
                            <tr>
                                <th className={thLeft}>Name</th>
                                <th className={thLeft}>Email</th>
                                <th className={thCenter}>Role</th>
                                <th className={thCenter}>Joined</th>
                                <th className={thCenter}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 dark:bg-[#212121] dark:divide-[#303030]">
                            {loadingUsers ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading users…</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No users found. Invite someone to get started.</td></tr>
                            ) : users.map((user) => {
                                const isPending = user.is_invite_pending;

                                return (
                                    <tr key={user.user_id} className={`transition-colors border-b border-[#F1F5F9] ${isPending ? 'bg-gray-50/50' : 'hover:bg-[#F8FAFC]'}`}>
                                        {/* Name */}
                                        <td className={`${tdLeft} text-[#1E293B] font-medium`}>
                                            <span className={isPending ? "text-[#94A3B8] italic" : ""}>{user.name || <span className="text-[#94A3B8] italic">—</span>}</span>
                                        </td>

                                        {/* Email — always read-only */}
                                        <td className={`${tdLeft} text-[#334155] text-sm`}>
                                            <span className={isPending ? "text-[#94A3B8] italic" : ""}>{user.username}</span>
                                        </td>

                                        {/* Role — static badge, no toggle */}
                                        <td className={tdCenter}>
                                            {isPending ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                    Pending Invite
                                                </span>
                                            ) : user.is_admin ? (
                                                <span className="px-[10px] py-[3px] inline-flex text-[12px] font-[600] rounded-full bg-[#FEF3C7] text-[#92400E]">Admin</span>
                                            ) : (
                                                <span className="px-[10px] py-[3px] inline-flex text-[12px] font-[600] rounded-full bg-[#E0F2FE] text-[#0369A1]">User</span>
                                            )}
                                        </td>


                                        {/* Joined */}
                                        <td className={tdCenter}>
                                            <span className="text-[13px] text-[#64748B]">
                                                {formatDate(user.created_at)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className={tdCenter}>
                                            <div className="flex items-center justify-center gap-4">
                                                <button 
                                                    onClick={() => setUserToDelete(user)} 
                                                    disabled={user.username === "admin"} 
                                                    title="Delete" 
                                                    className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#DC2626] disabled:pointer-events-none transition-all"
                                                >
                                                    <TrashIcon className="h-4 w-4 opacity-100" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={deleteUser}
                title={userToDelete?.is_invite_pending ? "Delete Invite" : "Delete User"}
                message={userToDelete?.is_invite_pending
                    ? `Delete the pending invite for ${userToDelete.username}? They will no longer be able to use the invite link.`
                    : `Delete ${userToDelete?.username} and all its data?\nThis cannot be undone.`}
                confirmText={deleting ? "Deleting..." : "Delete"}
            />
            </div>
        </div>
    );
}
