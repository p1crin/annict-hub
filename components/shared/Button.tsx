/**
 * Button Component
 * Reusable button with consistent styling
 */

'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className = '',
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2';

  const variants = {
    primary:
      'bg-gradient-to-r from-violet-500 to-pink-400 text-white hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-400',
    secondary:
      'bg-gradient-to-r from-emerald-400 to-sky-400 text-white hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-400',
    outline:
      'border-2 border-violet-500 text-violet-600 bg-white hover:bg-violet-50 disabled:border-gray-300 disabled:text-gray-400',
    ghost:
      'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400',
  };
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.05 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.95 } : {}}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
          />
          <span>処理中...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}
