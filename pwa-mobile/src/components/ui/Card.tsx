import React, { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'flat' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-slate-800 border border-slate-700',
    elevated: 'bg-slate-800 border border-slate-700 shadow-xl shadow-black/30',
    flat: 'bg-slate-900 border border-slate-800',
    interactive: 'bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-750 cursor-pointer transition-all duration-200 active:scale-[0.98]',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={`rounded-2xl ${variants[variant]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
