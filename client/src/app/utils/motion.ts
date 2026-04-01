export const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: PREMIUM_EASE },
  },
};

export const fadeUpSoft = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.48, ease: PREMIUM_EASE },
  },
};

export const staggerContainer = (delayChildren = 0.08, staggerChildren = 0.08) => ({
  hidden: {},
  visible: {
    transition: {
      delayChildren,
      staggerChildren,
    },
  },
});
