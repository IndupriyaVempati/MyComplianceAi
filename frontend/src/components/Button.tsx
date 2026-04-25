import { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
    const baseClasses = "inline-flex items-center justify-center rounded-[10px] px-6 py-3 text-sm font-[600] shadow-sm transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

    const variants: Record<ButtonVariant, string> = {
        primary: "bg-[#00386B] text-white hover:bg-[#00295A] border border-transparent",
        secondary: "bg-[#2B93D1] text-white hover:bg-[#2278AD] border border-transparent",
        accent: "bg-[#FFC20E] text-[#00386B] hover:bg-[#E6AE00] border border-transparent",
        danger: "bg-red-600 text-white hover:bg-red-500 border border-transparent",
        success: "bg-[#059669] text-white hover:bg-[#047857] border border-transparent"
    };

    const variantClass = variants[variant] || variants.primary;

    return (
        <button className={`${baseClasses} ${variantClass} ${className}`} {...props}>
            {children}
        </button>
    );
}
