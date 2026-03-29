/**
 * Loading Component
 * Displays loading state with animation
 */

'use client';

import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function Loading({
  message = '読み込み中...',
  size = 'md',
  fullScreen = false,
}: LoadingProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Spinner */}
      <div className={`relative ${sizes[size]}`}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 border-4 border-lavender-light rounded-full"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            borderTopColor: 'var(--lavender)',
            borderRightColor: 'var(--peach)',
          }}
        />

        {/* Inner sparkle */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-2xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          ✨
        </motion.div>
      </div>

      {/* Message */}
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-600 font-medium"
        >
          {message}
        </motion.p>
      )}

      {/* Floating decorations */}
      <div className="relative w-full h-8">
        <motion.div
          className="absolute left-1/4 text-xl"
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          ♪
        </motion.div>
        <motion.div
          className="absolute right-1/4 text-xl"
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        >
          ♪
        </motion.div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-dreamy flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
