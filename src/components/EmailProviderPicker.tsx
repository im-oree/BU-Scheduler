import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EMAIL_PROVIDERS,
  type EmailProvider,
  getProvider,
} from '../lib/emailProviders';

const colors = {
  primaryGreen: '#2ECC71',
  secondaryGreen: '#27AE60',
  darkBg: '#0D0F1C',
  cardBg: '#15182B',
  primaryText: '#FFFFFF',
  secondaryText: '#B3B6C6',
  divider: '#23263D',
};

/* ═══════════════════════════════════════════════════════════════
   PROVIDER MODAL
   ═══════════════════════════════════════════════════════════════ */

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeValue: string;
  onSelect: (value: string) => void;
}

export function EmailProviderModal({
  isOpen,
  onClose,
  activeValue,
  onSelect,
}: ProviderModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const idx = EMAIL_PROVIDERS.findIndex((p) => p.value === activeValue);
    if (idx >= 0) setSelectedIndex(idx);
  }, [activeValue]);

  const handleSelect = useCallback(
    (provider: EmailProvider, index: number) => {
      setSelectedIndex(index);
      setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          onSelect(provider.value);
          onClose();
          setIsExiting(false);
        }, 200);
      }, 150);
    },
    [onSelect, onClose],
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isExiting ? 0 : 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{
              opacity: isExiting ? 0 : 1,
              y: isExiting ? 50 : 0,
              scale: isExiting ? 0.95 : 1,
            }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 440,
            }}
          >
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(180deg, ${colors.cardBg} 0%, ${colors.darkBg} 100%)`,
                borderRadius: 24,
                boxShadow: `0 -10px 60px rgba(0,0,0,0.5), 0 0 0 1px ${colors.primaryGreen}1A`,
              }}
            >
              {/* Top accent line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${colors.primaryGreen}, transparent)`,
                }}
              />

              {/* Header */}
              <div
                style={{
                  position: 'relative',
                  paddingTop: 28,
                  paddingBottom: 20,
                  paddingLeft: 24,
                  paddingRight: 24,
                  textAlign: 'center',
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    damping: 15,
                    stiffness: 200,
                    delay: 0.1,
                  }}
                  style={{
                    position: 'relative',
                    width: 56,
                    height: 56,
                    margin: '0 auto 16px',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 16,
                      background: `${colors.primaryGreen}15`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 8,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: colors.divider,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🏫</span>
                  </div>
                </motion.div>

                <h2
                  style={{
                    color: colors.primaryText,
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 4,
                    margin: 0,
                  }}
                >
                  Select Email Provider
                </h2>
                <p
                  style={{
                    color: colors.secondaryText,
                    fontSize: 13,
                    maxWidth: 260,
                    margin: '4px auto 0',
                  }}
                >
                  Pick the provider that matches your email
                </p>
              </div>

              {/* Provider list */}
              <div
                style={{
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingBottom: 16,
                  maxHeight: '40vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  {EMAIL_PROVIDERS.map((provider, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isCurrentlyActive = activeValue === provider.value;
                    const isHighlighted = isSelected || isCurrentlyActive;

                    return (
                      <motion.button
                        key={provider.value}
                        type="button"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.05 }}
                        onClick={() => handleSelect(provider, idx)}
                        style={{
                          position: 'relative',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          backgroundColor: isHighlighted
                            ? `${colors.primaryGreen}12`
                            : `${colors.darkBg}CC`,
                          border: `2px solid ${
                            isHighlighted
                              ? `${colors.primaryGreen}50`
                              : colors.divider
                          }`,
                          borderRadius: 16,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: isHighlighted
                              ? `${colors.primaryGreen}20`
                              : `${colors.divider}60`,
                          }}
                        >
                          {provider.logo ? (
                            <img
                              src={provider.logo}
                              alt=""
                              style={{
                                width: 24,
                                height: 24,
                                objectFit: 'contain',
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 18 }}>
                              {provider.emoji ?? '🎓'}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <p
                            style={{
                              color: isHighlighted
                                ? colors.primaryGreen
                                : colors.primaryText,
                              fontSize: 14,
                              fontWeight: 600,
                              margin: 0,
                              marginBottom: 2,
                            }}
                          >
                            {provider.label}
                          </p>
                          <p
                            style={{
                              color: colors.secondaryText,
                              fontSize: 12,
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {provider.value}
                          </p>
                        </div>

                        {isHighlighted && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${colors.primaryGreen}, ${colors.secondaryGreen})`,
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderTop: `1px solid ${colors.divider}80`,
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    color: `${colors.secondaryText}99`,
                    fontSize: 11,
                    margin: 0,
                  }}
                >
                  💡 You can change this anytime
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROVIDER BADGE (tap-to-switch)
   ═══════════════════════════════════════════════════════════════ */

interface ProviderBadgeProps {
  activeValue: string;
  onClick: () => void;
}

export function EmailProviderBadge({
  activeValue,
  onClick,
}: ProviderBadgeProps) {
  const provider = getProvider(activeValue);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        background: isHovered
          ? `${colors.primaryGreen}15`
          : `${colors.primaryGreen}0A`,
        border: `1px solid ${colors.primaryGreen}25`,
        cursor: 'pointer',
        transition: 'background 0.15s',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.divider,
        }}
      >
        {provider?.logo ? (
          <img
            src={provider.logo}
            alt=""
            style={{ width: 20, height: 20, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 14 }}>{provider?.emoji ?? '🎓'}</span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <p
          style={{
            color: colors.primaryGreen,
            fontSize: 12,
            fontWeight: 600,
            margin: 0,
          }}
        >
          {provider?.label ?? 'Email Provider'}
        </p>
        <p
          style={{
            color: colors.secondaryText,
            fontSize: 11,
            margin: 0,
          }}
        >
          Tap to switch email provider
        </p>
      </div>

      <svg
        width="16"
        height="16"
        fill="none"
        stroke={colors.secondaryText}
        viewBox="0 0 24 24"
        style={{ flexShrink: 0 }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 9l4-4 4 4m0 6l-4 4-4-4"
        />
      </svg>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPLIT EMAIL INPUT (name + provider dropdown)
   ═══════════════════════════════════════════════════════════════ */

interface SplitEmailInputProps {
  username: string;
  onUsernameChange: (value: string) => void;
  activeValue: string;
  onOpenProviderModal: () => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Sanitize raw input — strips any known email-suffix variant from
 * the end of the string, plus any stray @ . , ; or whitespace.
 *
 * Handles:
 *   "john@gmail.com"                → "john"
 *   "johngmailcom"                  → "john"
 *   "jane@student.babcock.edu.ng"   → "jane"
 *   "janestudentbabcockedung"       → "jane"
 *   "JOHN@YAHOO.COM"                → "JOHN"
 */
function sanitizeEmailInput(raw: string): {
  cleaned: string;
  didStrip: boolean;
} {
  let value = raw;

  // Build list of suffix variants from all known providers
  const variants: string[] = [];
  for (const p of EMAIL_PROVIDERS) {
    const suffix = p.value;                  // "@student.babcock.edu.ng"
    const noAt = suffix.slice(1);            // "student.babcock.edu.ng"
    const noDots = noAt.replace(/\./g, '');  // "studentbabcockedung"

    variants.push(suffix, noAt, noDots);
  }

  // Longest first so we don't strip "gmail" when we should strip "@gmail.com"
  variants.sort((a, b) => b.length - a.length);

  let didStripSuffix = false;
  const lower = value.toLowerCase();

  for (const variant of variants) {
    const vLower = variant.toLowerCase();
    if (lower.endsWith(vLower) && variant.length > 0) {
      value = value.slice(0, value.length - variant.length);
      didStripSuffix = true;
      break;
    }
  }

  // Strip any remaining stray characters
  const beforeChars = value;
  value = value.replace(/[@.,;\s]/g, '');
  const didStripChars = value !== beforeChars;

  return {
    cleaned: value.trim(),
    didStrip: didStripSuffix || didStripChars,
  };
}

export function SplitEmailInput({
  username,
  onUsernameChange,
  activeValue,
  onOpenProviderModal,
  disabled,
  onFocus,
  onBlur,
}: SplitEmailInputProps) {
  const provider = getProvider(activeValue);
  const [isFocused, setIsFocused] = useState(false);
  const [justCleaned, setJustCleaned] = useState(false);

  const flashClean = () => {
    setJustCleaned(true);
    setTimeout(() => setJustCleaned(false), 600);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { cleaned, didStrip } = sanitizeEmailInput(e.target.value);
    onUsernameChange(cleaned);
    if (didStrip) flashClean();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const { cleaned, didStrip } = sanitizeEmailInput(pasted);
    onUsernameChange(cleaned);
    if (didStrip) flashClean();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        backgroundColor: colors.darkBg,
        borderRadius: 12,
        border: `2px solid ${
          justCleaned
            ? colors.primaryGreen
            : isFocused
            ? `${colors.primaryGreen}80`
            : colors.divider
        }`,
        boxShadow: justCleaned
          ? `0 0 0 3px ${colors.primaryGreen}30`
          : isFocused
          ? `0 0 0 3px ${colors.primaryGreen}12`
          : 'none',
        transition: 'all 0.2s',
        overflow: 'hidden',
      }}
    >
      <input
        type="text"
        value={username}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        placeholder="Your email name"
        disabled={disabled}
        autoComplete="email"
        required
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: colors.primaryText,
          fontSize: 15,
        }}
      />

      <button
        type="button"
        onClick={onOpenProviderModal}
        disabled={disabled}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          borderLeft: `1px solid ${colors.divider}`,
          background: `${colors.darkBg}80`,
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          color: colors.secondaryText,
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'filter 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.filter = 'brightness(1.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'brightness(1)';
        }}
      >
        {provider?.logo && (
          <img
            src={provider.logo}
            alt=""
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              objectFit: 'cover',
            }}
          />
        )}
        {!provider?.logo && provider?.emoji && (
          <span style={{ fontSize: 14 }}>{provider.emoji}</span>
        )}
        <span
          style={{
            fontWeight: 500,
            maxWidth: 140,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeValue}
        </span>
        <svg
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ flexShrink: 0 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}