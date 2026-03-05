'use client';

import type React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type GradientBackgroundProps = React.ComponentProps<"div"> & {
  // Animation customization
  gradients?: string[];
  animationDuration?: number;
  animationDelay?: number;

  // Layout customization
  enableCenterContent?: boolean;

  // Visual customization
  overlay?: boolean;
  overlayOpacity?: number;
};

const DEFAULT_GRADIENTS = [
  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
  "linear-gradient(135deg, #F7FAFC 0%, #2563eb 100%)",
  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
];

export function GradientBackground({
  children,
  className = "",
  gradients = DEFAULT_GRADIENTS,
  animationDuration = 8,
  animationDelay = 0.5,
  enableCenterContent = true,
  overlay = false,
  overlayOpacity = 0.3,
  ...props
}: GradientBackgroundProps) {
  return (
    <div
      className={cn("w-full relative min-h-screen overflow-hidden", className)}
      {...props}
    >
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{ background: gradients[0] }}
        animate={{ background: gradients }}
        transition={{
          delay: animationDelay,
          duration: animationDuration,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Optional overlay */}
      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}

      {/* Content wrapper */}
      {children && (
        <div
          className={cn(
            "relative z-10 min-h-screen",
            enableCenterContent && "flex items-center justify-center"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}






