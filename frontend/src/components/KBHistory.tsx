import { useEffect, useState } from "react";
import { ArrowLeftIcon, FunnelIcon } from "@heroicons/react/24/outline";

type HistoryEntry = {
    id: string;
    assistant_id: string | null;
    user_id: string;
    username: string;
    action: string;
    file_name: string | null;
    assistant_name: string | null;
    created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    assistant_created: { label: "KB Created", color: "bg-[#D1FAE5] text-[#065F46]" },
    assistant_deleted: { label: "KB Deleted", color: "bg-red-100 text-red-800" },
    file_uploaded: { label: "File Uploaded", color: "bg-[#E0F2FE] text-[#0369A1]" },
    file_deleted: { label: "File Removed", color: "bg-orange-100 text-orange-800" },
};

export function KBHistory({ onBack }: { onBack?: () => void }) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("all");

    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        fetch("/api/admin/kb-history", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load history");
                return res.json();
            })
            .then(setHistory)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    // Auto-dismiss fetch error after 3 seconds
    useEffect(() => {
        if (!error) return;
        const t = setTimeout(() => setError(null), 3000);
        return () => clearTimeout(t);
    }, [error]);

    const filtered = filter === "all" ? history : history.filter((h) => h.action === filter);

    return (
        <div className="flex-1 flex flex-col p-6 bg-[#F0F4F8] h-full overflow-hidden">
            {/* Header */}
            {onBack && (
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#00386B] transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back
                    </button>
                    <div className="h-4 w-px bg-[#E2E8F0]" />
                    <h1 className="text-xl font-bold text-[#00386B]">Knowledge Base Track</h1>
                </div>
            )}

            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <FunnelIcon className="h-4 w-4 text-[#64748B]" />
                {["all", "assistant_created", "assistant_deleted", "file_uploaded", "file_deleted"].map((f) => {
                    const label = f === "all" ? "All" : ACTION_LABELS[f]?.label ?? f;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${filter === f
                                    ? "bg-[#00386B] text-white"
                                    : "bg-transparent border border-[#E2E8F0] text-[#64748B] hover:bg-[#F0F4F8] hover:text-[#00386B]"
                                }`}
                        >
                            {label}
                        </button>
                    );
                })}
                <span className="ml-auto text-[13px] text-[#94A3B8]">
                    {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                </span>
            </div>

            {/* Content */}
            {loading && (
                <div className="flex justify-center py-12 text-gray-400 dark:text-[#8e8ea0]">Loading history…</div>
            )}
            {error && (
                <div className="text-red-500 py-4">{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-[#8e8ea0]">
                    <span className="text-4xl mb-3">📂</span>
                    <p>No history events yet.</p>
                </div>
            )}
            {!loading && !error && filtered.length > 0 && (
                <div className="flex-1 min-h-0 overflow-auto">
                <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                    <table className="min-w-[800px] w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] font-bold text-[#64748B] uppercase tracking-[0.08em] border-b-[2px] border-[#E2E8F0]">
                                <th className="pl-6 pr-4 py-3 font-bold bg-[#F8FAFC] sticky top-0 z-10 w-[140px]">Timestamp</th>
                                <th className="px-4 py-3 font-bold bg-[#F8FAFC] sticky top-0 z-10 w-[150px]">Event</th>
                                <th className="px-4 py-3 font-bold bg-[#F8FAFC] sticky top-0 z-10">File</th>
                                <th className="pl-4 pr-6 py-3 font-bold bg-[#F8FAFC] sticky top-0 z-10 w-[120px]">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                            {filtered.map((entry) => {
                                const actionMeta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "bg-gray-100 text-gray-600" };
                                const ts = new Date(entry.created_at);
                                const dateStr = ts.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                                const timeStr = ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                                return (
                                    <tr key={entry.id} className="bg-white hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9]">
                                        <td className="pl-6 pr-4 py-3 text-[#1E293B] whitespace-nowrap">
                                            <span className="block font-semibold text-[13px]">{dateStr}</span>
                                            <span className="block text-[12px] text-[#94A3B8]">{timeStr}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${actionMeta.color}`}>
                                                {actionMeta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[#334155] text-[13px] max-w-[280px] truncate" title={entry.file_name ?? ""}>
                                            {entry.file_name ?? <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="pl-4 pr-6 py-3 text-[#64748B] text-[13px]">
                                            {entry.username}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                </div>
            )}
        </div>
    );
}
