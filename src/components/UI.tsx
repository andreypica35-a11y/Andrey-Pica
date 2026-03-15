import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
      secondary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
      outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50',
      ghost: 'text-zinc-600 hover:bg-zinc-100',
      danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
    };
    return (
      <button
        ref={ref}
        className={cn('inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none', variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
  )
);

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

export const Badge = ({ children, variant = 'default', className, ...props }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'error', className?: string } & React.HTMLAttributes<HTMLSpanElement>) => {
  const variants = {
    default: 'bg-zinc-100 text-zinc-600',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span 
      className={cn("px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider", variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
};
