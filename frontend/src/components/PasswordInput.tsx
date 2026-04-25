import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface PasswordInputProps {
    id?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    minLength?: number;
    autoComplete?: string;
    disabled?: boolean;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    /** Extra classes applied to the wrapper div */
    wrapperClassName?: string;
}

export function PasswordInput({
    id,
    value,
    onChange,
    placeholder = "••••••••",
    className = "",
    required,
    minLength,
    autoComplete = "current-password",
    disabled,
    onFocus,
    onBlur,
    wrapperClassName = "",
}: PasswordInputProps) {
    const [show, setShow] = useState(false);

    return (
        <div className={`relative ${wrapperClassName}`}>
            <input
                id={id}
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`${className} pr-10`}
                required={required}
                minLength={minLength}
                autoComplete={autoComplete}
                disabled={disabled}
                onFocus={onFocus}
                onBlur={onBlur}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
                style={{ color: '#94A3B8' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#2B93D1'}
                onMouseOut={(e) => e.currentTarget.style.color = '#94A3B8'}
            >
                {show ? (
                    <EyeSlashIcon className="h-4 w-4" />
                ) : (
                    <EyeIcon className="h-4 w-4" />
                )}
            </button>
        </div>
    );
}
