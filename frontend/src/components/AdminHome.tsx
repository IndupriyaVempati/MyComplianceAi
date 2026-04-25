import { PlusIcon, ChatBubbleLeftRightIcon, UserGroupIcon, ArrowRightOnRectangleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

export function AdminHome(props: { onCreateRag: () => void; onAdminChats?: () => void; onAdminUsers?: () => void; onAdminKBHistory?: () => void }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("auth_token");
        navigate("/admin/login", { replace: true });
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto py-16 px-8 bg-white dark:bg-[#212121] min-h-[500px] relative">
            {/* Logout button top-right */}
            <button
                onClick={handleLogout}
                className="absolute top-6 right-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors dark:text-[#8e8ea0] dark:hover:text-red-400 dark:hover:bg-[#2a2a2a]"
                title="Sign out"
            >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Sign out
            </button>
            <div className="max-w-2xl w-full flex flex-col items-center">
                <h1 className="text-3xl font-semibold text-gray-900 mb-3 dark:text-[#ececec]">Admin Dashboard</h1>
                <p className="text-gray-500 mb-10 text-center max-w-[400px] leading-relaxed dark:text-[#8e8ea0]">
                    Manage your Bots, configure system settings, and review all user chat history.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-lg">
                    <button
                        onClick={props.onCreateRag}
                        className="group flex flex-col items-center gap-4 bg-gray-50 border border-gray-200 p-8 rounded-2xl hover:bg-gray-100 hover:border-gray-300 transition-all text-left dark:bg-[#2a2a2a] dark:border-[#3a3a3a] dark:hover:bg-[#333] dark:hover:border-[#4a4a4a]"
                    >
                        <div className="h-14 w-14 rounded-full bg-[#CFECFB] flex items-center justify-center group-hover:scale-105 transition-transform dark:bg-[#00386B]/30">
                            <PlusIcon className="h-7 w-7 text-[#00386B] dark:text-[#2B93D1]" />
                        </div>
                        <div className="text-center mt-1">
                            <h3 className="text-[17px] font-medium text-gray-900 mb-1.5 dark:text-[#ececec]">Knowledge Base</h3>
                            <p className="text-sm text-gray-500 leading-relaxed dark:text-[#8e8ea0]">
                                Upload a new file to the knowledge base's custom knowledge.
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={props.onAdminChats}
                        className="group flex flex-col items-center gap-4 bg-gray-50 border border-gray-200 p-8 rounded-2xl hover:bg-gray-100 hover:border-gray-300 transition-all text-left dark:bg-[#2a2a2a] dark:border-[#3a3a3a] dark:hover:bg-[#333] dark:hover:border-[#4a4a4a]"
                    >
                        <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center group-hover:scale-105 transition-transform dark:bg-[#3a3a3a]">
                            <ChatBubbleLeftRightIcon className="h-7 w-7 text-gray-500 dark:text-[#8e8ea0]" />
                        </div>
                        <div className="text-center mt-1">
                            <h3 className="text-[17px] font-medium text-gray-900 mb-1.5 dark:text-[#ececec]">Chat History</h3>
                            <p className="text-sm text-gray-500 leading-relaxed dark:text-[#8e8ea0]">
                                View all user conversations and feedback.
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={props.onAdminUsers}
                        className="group flex flex-col items-center gap-4 bg-gray-50 border border-gray-200 p-8 rounded-2xl hover:bg-gray-100 hover:border-gray-300 transition-all text-left dark:bg-[#2a2a2a] dark:border-[#3a3a3a] dark:hover:bg-[#333] dark:hover:border-[#4a4a4a]"
                    >
                        <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center group-hover:scale-105 transition-transform dark:bg-[#3a3a3a]">
                            <UserGroupIcon className="h-7 w-7 text-gray-500 dark:text-[#8e8ea0]" />
                        </div>
                        <div className="text-center mt-1">
                            <h3 className="text-[17px] font-medium text-gray-900 mb-1.5 dark:text-[#ececec]">User Management</h3>
                            <p className="text-sm text-gray-500 leading-relaxed dark:text-[#8e8ea0]">
                                Create user credentials and generate email invites.
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={props.onAdminKBHistory}
                        className="group flex flex-col items-center gap-4 bg-gray-50 border border-gray-200 p-8 rounded-2xl hover:bg-gray-100 hover:border-gray-300 transition-all text-left dark:bg-[#2a2a2a] dark:border-[#3a3a3a] dark:hover:bg-[#333] dark:hover:border-[#4a4a4a]"
                    >
                        <div className="h-14 w-14 rounded-full bg-violet-50 flex items-center justify-center group-hover:scale-105 transition-transform dark:bg-violet-500/10">
                            <ClockIcon className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="text-center mt-1">
                            <h3 className="text-[17px] font-medium text-gray-900 mb-1.5 dark:text-[#ececec]">Knowledge Base Track</h3>
                            <p className="text-sm text-gray-500 leading-relaxed dark:text-[#8e8ea0]">
                                View the full audit log of knowledge base changes.
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
