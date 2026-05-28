import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

export type BearMood =
  | 'idle'
  | 'tracking'
  | 'hiding'
  | 'peeking'
  | 'sad'
  | 'happy';

interface BearMascotProps {
  mood: BearMood;
  /** 0 to 1 — drives 3D head tracking based on email progress */
  emailProgress?: number;
}

export function BearMascot({ mood, emailProgress = 0 }: BearMascotProps) {
  const prefersReducedMotion = useReducedMotion();

  // Normalize progress to a -1 → +1 range (so head turns left/right around center)
  const t = Math.min(Math.max(emailProgress, 0), 1);
  const turn = t * 2 - 1; // -1 (left) → +1 (right)

  // 3D-ish transforms driven by typing progress
  const rotateY = turn * 22; // left/right head turn
  const rotateX = -Math.abs(turn) * 4 - 2; // slight downward tilt as it scans
  const rotateZ = turn * 3; // tiny head sway

  // Eye shift adds extra liveliness on top of head turn
  const eyeShift = turn * 3;

  // Subtle idle breathing
  const [breathe, setBreathe] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion) return;
    const i = setInterval(() => setBreathe((b) => !b), 2000);
    return () => clearInterval(i);
  }, [prefersReducedMotion]);

  const hiding = mood === 'hiding';
  const peeking = mood === 'peeking';
  const sad = mood === 'sad';
  const happy = mood === 'happy';
  const tracking = mood === 'tracking';

  // Outer container animation (sad shake / happy bounce / idle breath)
  const containerAnim = prefersReducedMotion
    ? {}
    : sad
    ? { x: [-6, 6, -6, 6, 0], transition: { duration: 0.4 } }
    : happy
    ? { y: [0, -8, 0, -4, 0], transition: { duration: 0.6 } }
    : { scale: breathe ? 1.01 : 1, transition: { duration: 2 } };

  // 3D head animation (driven by typing)
  const headAnim = prefersReducedMotion
    ? {}
    : {
        rotateX: tracking ? rotateX : 0,
        rotateY: tracking ? rotateY : 0,
        rotateZ: tracking ? rotateZ : 0,
      };

  return (
    <motion.div
      animate={containerAnim}
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 12,
        // 3D perspective so child rotations look spatial
        perspective: 800,
      }}
      aria-hidden="true"
    >
      <motion.div
        animate={headAnim}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        style={{
          width: 140,
          height: 140,
          transformStyle: 'preserve-3d',
          transformOrigin: '50% 60%', // pivot around the neck-ish area
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Soft green circle background (stays flat — sits behind the head) */}
          <circle cx="100" cy="100" r="95" fill="#CDE39A" />

          {/* Ears (outer) */}
          <circle cx="55" cy="65" r="20" fill="#8B5A2B" />
          <circle cx="145" cy="65" r="20" fill="#8B5A2B" />
          {/* Ears (inner) */}
          <circle cx="55" cy="65" r="10" fill="#6B4423" />
          <circle cx="145" cy="65" r="10" fill="#6B4423" />

          {/* Head */}
          <ellipse cx="100" cy="110" rx="58" ry="55" fill="#A0673A" />

          {/* Subtle shading on one side for 3D feel */}
          <ellipse
            cx="100"
            cy="110"
            rx="58"
            ry="55"
            fill="url(#shading)"
            opacity="0.25"
          />

          {/* Snout (lighter) */}
          <ellipse cx="100" cy="135" rx="32" ry="25" fill="#D4A373" />

          {/* Eyes */}
          <AnimatePresence>
            {!hiding && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.ellipse
                  cx={80}
                  cy={sad ? 112 : 108}
                  rx="5"
                  ry={sad ? 3 : happy ? 2 : 5}
                  fill="#2B1810"
                  animate={{ cx: 80 + eyeShift }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />
                <motion.ellipse
                  cx={120}
                  cy={sad ? 112 : 108}
                  rx="5"
                  ry={sad ? 3 : happy ? 2 : 5}
                  fill="#2B1810"
                  animate={{ cx: 120 + eyeShift }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />

                {tracking && (
                  <>
                    <circle cx={82 + eyeShift} cy={106} r="1.3" fill="white" />
                    <circle cx={122 + eyeShift} cy={106} r="1.3" fill="white" />
                  </>
                )}
              </motion.g>
            )}
          </AnimatePresence>

          {/* Nose */}
          <ellipse cx="100" cy="128" rx="6" ry="5" fill="#2B1810" />

          {/* Mouth */}
          {happy ? (
            <path
              d="M 88 145 Q 100 155 112 145"
              stroke="#2B1810"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          ) : sad ? (
            <path
              d="M 88 150 Q 100 142 112 150"
              stroke="#2B1810"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 94 143 Q 100 148 106 143"
              stroke="#2B1810"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Paws */}
          <AnimatePresence>
            {(hiding || peeking) && (
              <>
                <motion.g
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: peeking ? 25 : 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 18,
                  }}
                >
                  <ellipse cx="70" cy="115" rx="22" ry="20" fill="#8B5A2B" />
                  <ellipse cx="70" cy="115" rx="14" ry="12" fill="#A0673A" />
                </motion.g>
                <motion.g
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: peeking ? 25 : 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 18,
                    delay: 0.03,
                  }}
                >
                  <ellipse cx="130" cy="115" rx="22" ry="20" fill="#8B5A2B" />
                  <ellipse cx="130" cy="115" rx="14" ry="12" fill="#A0673A" />
                </motion.g>
              </>
            )}
          </AnimatePresence>

          {/* Happy cheeks */}
          {happy && (
            <>
              <circle cx="70" cy="135" r="6" fill="#FF9999" opacity="0.5" />
              <circle cx="130" cy="135" r="6" fill="#FF9999" opacity="0.5" />
            </>
          )}

          {/* Gradient defs for 3D shading */}
          <defs>
            <radialGradient id="shading" cx="0.7" cy="0.3" r="0.8">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
            </radialGradient>
          </defs>
        </svg>
      </motion.div>
    </motion.div>
  );
}