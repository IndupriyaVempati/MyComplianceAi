import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

export function PurchaseHistory() {
    const navigate = useNavigate();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
    const [hoveredGroup, setHoveredGroup] = useState<any | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/billing/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 404 || res.status === 204) {
                setHistory([]);
                return;
            }
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                setHistory([]);
                return;
            }
            if (!res.ok) {
                throw new Error("Failed to load purchase history");
            }
            const data = await res.json();
            setHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const processHistory = (rawHistory: any[]) => {
        const groups = new Map<number, any[]>();
        for (const item of rawHistory) {
            const minuteKey = Math.floor(item.created / 60);
            if (!groups.has(minuteKey)) groups.set(minuteKey, []);
            groups.get(minuteKey)!.push(item);
        }

        const result = Array.from(groups.values()).map(lines => {
            const net_amount = lines.reduce((sum, l) => sum + l.amount_paid, 0);
            const display_amount = Math.max(0, net_amount);

            let mainLine = lines.find(l => l.amount_paid >= 0) || lines[0];
            let action = mainLine.event_name || 'Update';
            const actionLower = action.toLowerCase();

            if (actionLower.includes('created') || actionLower.includes('started')) {
                action = 'Subscription started';
            } else if (lines.length > 1 || actionLower.includes('modification') || actionLower.includes('switched') || actionLower.includes('upgrade') || actionLower.includes('downgrade')) {
                const planBase = mainLine.plan_name ? mainLine.plan_name.split(' (')[0] : 'Plan';
                action = `Switched to ${planBase}`;
            }

            return {
                id: mainLine.id || Math.random().toString(),
                created: mainLine.created || lines[0].created,
                action,
                plan_name: mainLine.plan_name || '—',
                net_amount,
                display_amount,
                receipt_url: lines.find(l => l.hosted_invoice_url || l.invoice_pdf)?.hosted_invoice_url 
                            || lines.find(l => l.hosted_invoice_url || l.invoice_pdf)?.invoice_pdf,
                lines: [...lines].sort((a,b) => a.amount_paid - b.amount_paid) // Credits first
            };
        });

        return result.sort((a, b) => b.created - a.created);
    };

    const groupedHistory = processHistory(history);

    return (
        <div className="min-h-screen bg-[#F0F4F8] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                    <button
                        onClick={() => navigate(-1)}
                        title="Back"
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors shrink-0"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    {history.length > 0 && (
                        <div className="flex-1 flex flex-col items-center text-center px-4">
                            <h1 className="text-3xl font-[700] text-[#00386B] mb-1">
                                Purchase History
                            </h1>
                            <p className="text-[#64748B] text-[14px]">
                                View your previous recurring invoices and receipts.
                            </p>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <svg className="animate-spin h-8 w-8 text-[#00386B]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : groupedHistory.length === 0 ? (
                    <div className="bg-white dark:bg-[#1a1a1a] shadow rounded-xl p-12 text-center border border-gray-100 dark:border-[#2a2a2a]">
                        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No purchases found</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">You don't have any billing history with us yet.</p>
                    </div>
                ) : (
                    <div className="bg-[#FFFFFF] shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-[16px] overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="min-w-[800px] w-full border-collapse">
                                <thead className="bg-white border-b-2 border-[#E2E8F0]">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Date & Time</th>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Action</th>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Plan</th>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Amount</th>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Details</th>
                                        <th scope="col" className="px-6 py-3 text-center text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em]">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-[#F1F5F9]">
                                    {groupedHistory.map((group) => {
                                        return (
                                        <React.Fragment key={group.id}>
                                            <tr className="hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                                                <td className="px-6 py-6 whitespace-nowrap text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-[600] text-[#1E293B] text-sm">
                                                            {new Date(group.created * 1000).toLocaleDateString('en-GB', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                        <span className="text-[12px] font-medium text-[#94A3B8] mt-1 uppercase tracking-tighter">
                                                            at {new Date(group.created * 1000).toLocaleTimeString('en-GB', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: false
                                                            })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 whitespace-nowrap text-sm text-[#334155] font-[500] text-center">
                                                    {group.action}
                                                </td>
                                                <td className="px-6 py-6 whitespace-nowrap text-sm text-[#334155] font-[500] text-center">
                                                    {group.plan_name}
                                                </td>
                                                <td className="px-6 py-6 whitespace-nowrap text-sm font-[700] text-[#00386B] text-center">
                                                    ${(group.display_amount / 100).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-6 whitespace-nowrap text-center">
                                                    {group.lines.length > 0 && (
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedGroup(group);
                                                                setHoveredGroup(null); // Close hover on click
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setTooltipPos({ 
                                                                    top: rect.top + window.scrollY, 
                                                                    left: rect.left + window.scrollX 
                                                                });
                                                                setHoveredGroup(group);
                                                            }}
                                                            onMouseLeave={() => {
                                                                hoverTimeoutRef.current = setTimeout(() => {
                                                                    setHoveredGroup(null);
                                                                }, 100);
                                                            }}
                                                            className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-[#EFF6FF] transition-all duration-200 focus:outline-none active:scale-95"
                                                        >
                                                            <InformationCircleIcon className="h-6 w-6 text-[#2B93D1]" />
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-6 py-6 whitespace-nowrap text-center">
                                                    {group.receipt_url && (
                                                        <a
                                                            href={group.receipt_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="View Receipt"
                                                            className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 text-[#64748B] hover:text-[#00386B] transition-colors"
                                                        >
                                                            <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Persistent Billing Details Modal (Click) */}
            {selectedGroup && (
                /* ...existing modal code remains identical... */
                <div 
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setSelectedGroup(null)}
                >
                    <div 
                        className="bg-white dark:bg-[#1a1a1a] w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 className="text-lg font-[700] text-[#00386B]">Transaction Breakdown</h3>
                            <button 
                                onClick={() => setSelectedGroup(null)}
                                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <svg className="h-5 w-5 text-[#94A3B8] hover:text-[#00386B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <div className="mb-6">
                                <div className="text-[11px] uppercase tracking-[0.1em] font-[700] text-[#64748B] mb-1">Transaction</div>
                                <div className="text-xl font-[700] text-[#1E293B] tracking-tight">{selectedGroup.action}</div>
                                <div className="text-[14px] text-[#64748B] mt-1">
                                    {new Date(selectedGroup.created * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(selectedGroup.created * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            <div className="bg-[#F0F4F8] rounded-[10px] p-4 mb-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.1em]">Total Charged</span>
                                    <span className="text-[24px] font-[800] text-[#00386B]">
                                        ${(selectedGroup.display_amount / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-[11px] uppercase tracking-[0.1em] font-[700] text-[#64748B]">Billing Breakdown</div>
                                <ul className="space-y-3">
                                    {selectedGroup.lines.map((line: any) => {
                                        const basePlan = line.plan_name ? line.plan_name.split(' (')[0] : 'Plan';
                                        const isCredit = line.amount_paid < 0;
                                        const sign = isCredit ? '-' : '+';
                                        const label = isCredit ? `Credit for unused ${basePlan} plan` : `Charge for ${basePlan} plan`;
                                        return (
                                            <li key={line.id} className="flex justify-between items-start gap-4 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                                <div className="flex flex-col">
                                                    <span className="text-[14px] font-[500] text-[#1E293B] leading-tight">{label}</span>
                                                    <span className="text-[12px] text-[#94A3B8] mt-0.5">Line item adjustment</span>
                                                </div>
                                                <span className={`text-sm font-[600] whitespace-nowrap px-2.5 py-1 ${isCredit ? 'text-[#059669]' : 'text-[#1E293B]'}`}>
                                                    {sign}${Math.abs(line.amount_paid / 100).toFixed(2)}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Quick Glance Tooltip Portal (Hover) */}
            {hoveredGroup && createPortal(
                <div 
                    className="fixed z-[400] w-80 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto cursor-pointer"
                    style={{ 
                        top: tooltipPos.top - 10, // Slightly offset above
                        left: tooltipPos.left - 330, // Position to the left of the icon
                    }}
                    onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    }}
                    onMouseLeave={() => {
                        setHoveredGroup(null);
                    }}
                    onClick={() => {
                        setSelectedGroup(hoveredGroup);
                        setHoveredGroup(null);
                    }}
                >
                    <div className="bg-white border border-[#E2E8F0] p-5 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.10)] text-left">
                        <div className="flex items-center justify-between py-1 border-b border-gray-100 mb-3">
                            <span className="text-[11px] uppercase tracking-[0.08em] font-[700] text-[#64748B]">Total</span>
                            <span className="text-base font-[700] text-[#00386B]">
                                ${(hoveredGroup.display_amount / 100).toFixed(2)}
                            </span>
                        </div>
                        <ul className="space-y-2.5">
                            {hoveredGroup.lines.map((line: any) => {
                                const basePlan = line.plan_name ? line.plan_name.split(' (')[0] : 'Plan';
                                const isCredit = line.amount_paid < 0;
                                const sign = isCredit ? '-' : '+';
                                const label = isCredit ? `Credit: ${basePlan}` : `${basePlan}`;
                                return (
                                    <li key={line.id} className="flex justify-between items-center gap-4 text-[13px]">
                                        <span className="text-gray-600 leading-tight truncate">{label}</span>
                                        <span className={`font-[600] whitespace-nowrap ${isCredit ? 'text-[#059669]' : 'text-[#1E293B]'}`}>
                                            {sign}${Math.abs(line.amount_paid / 100).toFixed(2)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="mt-4 pt-3 border-t border-gray-50 text-[10px] text-center text-[#94A3B8] uppercase tracking-[0.1em] font-[700]">
                            Click for full details
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
