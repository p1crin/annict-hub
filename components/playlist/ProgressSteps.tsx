/**
 * Progress Steps Component
 * Shows progress through multi-step playlist creation
 */

'use client';

import { motion } from 'framer-motion';

export interface Step {
  id: string;
  label: string;
  emoji: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  completedSteps?: number[];
}

export default function ProgressSteps({
  steps,
  currentStep,
  completedSteps = [],
}: ProgressStepsProps) {
  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    font-bold text-lg transition-all duration-300
                    ${
                      completedSteps.includes(index)
                        ? 'bg-gradient-to-r from-mint to-baby-blue text-white shadow-lg'
                        : index === currentStep
                        ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-lg scale-110'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {completedSteps.includes(index) ? '✓' : step.emoji}
                </motion.div>

                {/* Label */}
                <p
                  className={`
                    mt-2 text-sm font-medium text-center
                    ${
                      index === currentStep
                        ? 'text-lavender font-bold'
                        : completedSteps.includes(index)
                        ? 'text-gray-700'
                        : 'text-gray-500'
                    }
                  `}
                >
                  {step.label}
                </p>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-4 relative">
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        completedSteps.includes(index) || index < currentStep
                          ? '100%'
                          : '0%',
                    }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-gradient-to-r from-lavender to-peach rounded-full"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <div className="flex items-center gap-4">
          {/* Current step indicator */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-lavender to-peach text-white font-bold text-lg shadow-lg">
            {steps[currentStep]?.emoji}
          </div>

          {/* Step info */}
          <div className="flex-1">
            <p className="text-sm text-gray-500">
              ステップ {currentStep + 1} / {steps.length}
            </p>
            <p className="text-lg font-bold text-gray-800">
              {steps[currentStep]?.label}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-lavender to-peach"
          />
        </div>
      </div>
    </div>
  );
}
