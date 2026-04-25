import { useState, useEffect } from "react";

export function useTrialStatus() {
    const [isExpired, setIsExpired] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const token = localStorage.getItem("auth_token");
                if (!token) {
                    setIsLoading(false);
                    return;
                }

                const res = await fetch("/api/auth/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.is_admin) {
                        setIsExpired(false);
                    } else if (data.plan_type === "freemium" && data.created_at) {
                        const created = new Date(data.created_at);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - created.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        setIsExpired((7 - diffDays) <= 0);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch trial status in hook", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
    }, []);

    return { isExpired, isLoading };
}
