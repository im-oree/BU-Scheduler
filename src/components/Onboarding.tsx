import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

type Step = {
  id: string;
  title: string;
  description: string;
  selector?: string;
  action?: { label: string; to?: string; onClick?: () => void; id?: string };
};

const DEFAULT_STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to BU Scheduler',
    description:
      "This app helps you view your timetable, join course groups, and stay on top of class updates. Let's take a quick tour!",
    action: { label: 'Get started', to: '/home', id: 'onboarding-start' },
  },
  {
    id: 'home',
    title: 'Dashboard Overview',
    description: 'Your upcoming classes and group summaries appear here at a glance.',
    selector: '#home-page-frame',
  },
  {
    id: 'groups',
    title: 'Groups',
    description: 'Find and join course groups. Use the Join button to add a group to your schedule.',
    selector: '#groups-page-frame',
    action: { label: 'Open groups', to: '/groups', id: 'onboarding-open-groups' },
  },
  {
    id: 'timetable',
    title: 'Timetable',
    description: 'Your weekly schedule is displayed here so you never miss a class.',
    selector: '#timetable-page-frame',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Activity alerts and group updates will show up here.',
    selector: '#notifications-page-frame',
  },
  {
    id: 'profile',
    title: 'Account',
    description: 'Manage your profile settings and sign out from this page.',
    selector: '#profile-page-frame',
  },
];

const STYLE_ID = 'onboarding-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ob-fade-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes ob-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Vignette overlay — dark edges, transparent center */
    .ob-vignette {
      position: fixed;
      inset: 0;
      z-index: 99990;
      pointer-events: auto;
      background: radial-gradient(
        ellipse 60% 50% at 50% 50%,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0.25) 50%,
        rgba(0,0,0,0.7) 100%
      );
      transition: opacity 300ms ease;
    }

    /* Welcome-only: slightly more dimmed so text is readable */
    .ob-vignette-welcome {
      position: fixed;
      inset: 0;
      z-index: 99990;
      pointer-events: auto;
      background: radial-gradient(
        ellipse 50% 45% at 50% 50%,
        rgba(0,0,0,0.35) 0%,
        rgba(0,0,0,0.65) 60%,
        rgba(0,0,0,0.8) 100%
      );
    }

    .ob-spotlight {
      position: fixed;
      z-index: 99995;
      border-radius: 10px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);
      pointer-events: none;
      transition: top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease;
    }

    .ob-modal {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      width: 440px;
      max-width: calc(100vw - 32px);
      border-radius: 16px;
      padding: 28px 24px 20px;
      background: #1a1a2e;
      color: #e2e2e2;
      box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
      animation: ob-fade-in 300ms ease both;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .ob-tooltip {
      position: fixed;
      z-index: 99999;
      width: 340px;
      max-width: calc(100vw - 24px);
      border-radius: 14px;
      padding: 20px 18px 16px;
      background: #1a1a2e;
      color: #e2e2e2;
      box-shadow: 0 12px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06);
      animation: ob-slide-up 220ms ease both;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .ob-tooltip::before {
      content: '';
      position: absolute;
      top: -7px;
      left: 24px;
      width: 14px;
      height: 14px;
      background: #1a1a2e;
      border-radius: 2px;
      transform: rotate(45deg);
      box-shadow: -1px -1px 0 0 rgba(255,255,255,0.06);
    }
    /* When tooltip is above the anchor, flip the arrow */
    .ob-tooltip.above::before {
      top: auto;
      bottom: -7px;
      box-shadow: 1px 1px 0 0 rgba(255,255,255,0.06);
    }

    .ob-title {
      margin: 0 0 8px;
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }
    .ob-desc {
      margin: 0 0 16px;
      font-size: 0.92rem;
      line-height: 1.55;
      color: #a0a0b8;
    }
    .ob-dots {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .ob-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      transition: background 200ms, transform 200ms;
    }
    .ob-dot.active {
      background: #6c63ff;
      transform: scale(1.3);
    }
    .ob-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .ob-btn {
      border: none;
      border-radius: 10px;
      padding: 9px 16px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms, opacity 150ms;
      font-family: inherit;
    }
    .ob-btn:active { transform: scale(0.97); }
    .ob-btn-skip {
      background: transparent;
      color: #737390;
    }
    .ob-btn-skip:hover { color: #a0a0b8; }
    .ob-btn-prev {
      background: rgba(255,255,255,0.06);
      color: #c0c0d0;
    }
    .ob-btn-prev:hover { background: rgba(255,255,255,0.1); }
    .ob-btn-prev:disabled {
      opacity: 0.3;
      cursor: default;
      pointer-events: none;
    }
    .ob-btn-primary {
      background: #6c63ff;
      color: #fff;
    }
    .ob-btn-primary:hover { background: #5a52e0; }
    .ob-btn-next {
      background: rgba(255,255,255,0.08);
      color: #e2e2e2;
    }
    .ob-btn-next:hover { background: rgba(255,255,255,0.13); }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Hook: poll for anchor element rect                                 */
/* ------------------------------------------------------------------ */
function useAnchorRect(selector?: string, active = true) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    function poll() {
      try {
        const el = document.querySelector(selector!) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            setRect(r);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      attempts++;
      if (attempts >= maxAttempts && intervalRef.current) {
        clearInterval(intervalRef.current);
        setRect(null);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selector, active]);

  useEffect(() => {
    if (!active || !selector) return;

    function update() {
      try {
        const el = document.querySelector(selector!) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) setRect(r);
        }
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [selector, active]);

  return rect;
}

/* ------------------------------------------------------------------ */
/*  Tooltip position                                                   */
/* ------------------------------------------------------------------ */
function computeTooltipPos(anchor: DOMRect | null, tooltipW = 340) {
  if (!anchor) {
    return {
      top: window.innerHeight / 2 - 100,
      left: Math.max(12, (window.innerWidth - tooltipW) / 2),
      above: false,
    };
  }

  const gap = 14;
  let left = anchor.left;
  let above = false;

  if (left + tooltipW > window.innerWidth - 12) {
    left = window.innerWidth - tooltipW - 12;
  }
  if (left < 12) left = 12;

  let top = anchor.bottom + gap;

  // If it would go below viewport, place above
  if (top + 180 > window.innerHeight) {
    top = anchor.top - 180 - gap;
    above = true;
    if (top < 12) top = 12;
  }

  return { top, left, above };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function Onboarding({ steps = DEFAULT_STEPS }: { steps?: Step[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const step = steps[index];
  const isWelcome = index === 0 && !step?.selector;
  const isLast = index === steps.length - 1;

  const anchor = useAnchorRect(step?.selector, visible && !isWelcome);

  useEffect(() => {
    ensureStyles();
  }, []);

  useEffect(() => {
    const dismissed = window.localStorage.getItem('onboarding.dismissed');
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (navigating) {
      const t = setTimeout(() => setNavigating(false), 100);
      return () => clearTimeout(t);
    }
  }, [location.pathname, navigating]);

  const dismiss = useCallback(() => {
    setVisible(false);
    window.localStorage.setItem('onboarding.dismissed', '1');
  }, []);

  const next = useCallback(() => {
    if (index + 1 >= steps.length) {
      dismiss();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, steps, dismiss]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const performAction = useCallback(async () => {
    if (!step?.action) return;
    if (step.action.onClick) {
      await step.action.onClick();
    }
    if (step.action.to) {
      setNavigating(true);
      navigate(step.action.to);
    }
    setTimeout(() => {
      next();
    }, 150);
  }, [step, navigate, next]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    },
    [visible, dismiss, next, prev],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible || !step) return null;

  const dots = (
    <div className="ob-dots">
      {steps.map((s, i) => (
        <div key={s.id} className={`ob-dot${i === index ? ' active' : ''}`} />
      ))}
    </div>
  );

  /* ---------- Welcome modal ---------- */
  if (isWelcome) {
    return createPortal(
      <>
        <div className="ob-vignette-welcome" onClick={dismiss} />
        <div className="ob-modal" role="dialog" aria-modal="true" aria-label={step.title}>
          <h2 className="ob-title" style={{ fontSize: '1.35rem', marginBottom: 10 }}>
            {step.title}
          </h2>
          <p className="ob-desc" style={{ fontSize: '0.95rem' }}>{step.description}</p>
          <div className="ob-footer">
            {dots}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ob-btn ob-btn-skip" onClick={dismiss}>
                Skip tour
              </button>
              <button
                id={step.action?.id}
                className="ob-btn ob-btn-primary"
                onClick={performAction}
              >
                {step.action?.label ?? 'Next'}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  /* ---------- Tooltip step ---------- */
  const pos = computeTooltipPos(anchor);
  const PAD = 8;

  return createPortal(
    <>
      {/* Vignette — no blur, just dark edges fading to transparent center */}
      <div className="ob-vignette" onClick={dismiss} />

      {/* Spotlight cutout around the target element */}
      {anchor && (
        <div
          className="ob-spotlight"
          style={{
            top: anchor.top - PAD,
            left: anchor.left - PAD,
            width: anchor.width + PAD * 2,
            height: anchor.height + PAD * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={`ob-tooltip${pos.above ? ' above' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        style={{ top: pos.top, left: pos.left }}
        key={step.id}
      >
        <h3 className="ob-title">{step.title}</h3>
        <p className="ob-desc">{step.description}</p>
        <div className="ob-footer">
          {dots}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ob-btn ob-btn-prev" onClick={prev} disabled={index <= 1}>
              ← Prev
            </button>
            {step.action && (
              <button
                id={step.action.id}
                className="ob-btn ob-btn-primary"
                onClick={performAction}
              >
                {step.action.label}
              </button>
            )}
            <button className="ob-btn ob-btn-next" onClick={next}>
              {isLast ? 'Finish ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default Onboarding;