import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/* ═══════════════════════════════════════════════════════════════
   BUTTON
   ═══════════════════════════════════════════════════════════════ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth && 'button--full-width',
    loading && 'button--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="button__spinner" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{ animation: 'spin 700ms linear infinite' }}
          >
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="2.5"
            />
            <path
              d="M9 2a7 7 0 0 1 7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      ) : leadingIcon ? (
        <span className="button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}

      <span>{children}</span>

      {!loading && trailingIcon ? (
        <span className="button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════ */

type CardProps = {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  as?: 'section' | 'div' | 'article';
};

export function Card({
  children,
  className = '',
  hoverable = false,
  as: Tag = 'section',
}: CardProps) {
  const classes = ['card', hoverable && 'card--hoverable', className]
    .filter(Boolean)
    .join(' ');

  return <Tag className={classes}>{children}</Tag>;
}

/* ═══════════════════════════════════════════════════════════════
   BADGE
   ═══════════════════════════════════════════════════════════════ */

type BadgeProps = {
  tone?: BadgeTone;
  pulse?: boolean;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', pulse = false, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}${pulse ? ' badge--pulse' : ''}`}>
      {pulse && (
        <span
          className="badge__dot"
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            animation: 'pulse-dot 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PILL  (lighter weight alternative to Badge)
   ═══════════════════════════════════════════════════════════════ */

export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   FIELD WRAPPER (internal)
   ═══════════════════════════════════════════════════════════════ */

type FieldWrapperProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

function FieldWrapper({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldWrapperProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#fca5a5' }}>
            {' '}
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}

      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INPUT
   ═══════════════════════════════════════════════════════════════ */

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  leadingIcon?: ReactNode;
};

export function Input({
  label,
  hint,
  error,
  required,
  leadingIcon,
  className = '',
  ...props
}: InputProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <div className="input-wrapper">
        {leadingIcon && (
          <span className="input-wrapper__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          className={`input${leadingIcon ? ' input--with-icon' : ''} ${className}`.trim()}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TEXTAREA
   ═══════════════════════════════════════════════════════════════ */

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  showCount?: boolean;
};

export function Textarea({
  label,
  hint,
  error,
  required,
  showCount = false,
  maxLength,
  className = '',
  value,
  defaultValue,
  onChange,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const [charCount, setCharCount] = useState(
    () => String(value ?? defaultValue ?? '').length,
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    },
    [onChange],
  );

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <textarea
        id={id}
        className={`input input--textarea ${className}`.trim()}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        {...props}
      />
      {showCount && maxLength && (
        <span
          className="field__hint"
          style={{ textAlign: 'right', tabularNums: 'tabular-nums' } as React.CSSProperties}
        >
          {charCount}/{maxLength}
        </span>
      )}
    </FieldWrapper>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELECT
   ═══════════════════════════════════════════════════════════════ */

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Select({
  label,
  hint,
  error,
  required,
  className = '',
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <select
        id={id}
        className={`input ${className}`.trim()}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON BLOCK
   ═══════════════════════════════════════════════════════════════ */

type SkeletonBlockProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  radius?: string | number;
};

export function SkeletonBlock({
  className = '',
  width,
  height,
  radius,
}: SkeletonBlockProps) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
      style={{
        width: width ?? '100%',
        height: height ?? undefined,
        minHeight: height ?? 18,
        borderRadius: radius ?? undefined,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON GROUP — easy multi-line skeleton
   ═══════════════════════════════════════════════════════════════ */

export function SkeletonGroup({
  lines = 3,
  gap = 10,
}: {
  lines?: number;
  gap?: number;
}) {
  const widths = ['100%', '85%', '60%', '92%', '70%', '78%'];
  return (
    <div
      style={{ display: 'grid', gap }}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={widths[i % widths.length]}
          height={14}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════ */

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <div>
        <h3>{title}</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          {description}
        </p>
      </div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */

type TabItem = { id: string; label: string; badge?: string; icon?: ReactNode };

type TabsProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (tabId: string) => void;
};

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeIndex = tabs.findIndex((t) => t.id === activeId);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let nextIndex = activeIndex;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (activeIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      const nextTab = tabs[nextIndex];
      onChange(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    },
    [activeIndex, onChange, tabs],
  );

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label="Section tabs"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={
              isActive ? 'tabs__tab tabs__tab--active' : 'tabs__tab'
            }
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && (
              <span className="button__icon" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span className="tabs__badge">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════════ */

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Trap focus & restore on close
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    const timer = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthMap = {
    sm: 480,
    md: 720,
    lg: 960,
  };

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        className="modal__overlay"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="modal__panel"
        tabIndex={-1}
        style={{ width: `min(${widthMap[size]}px, 100%)` }}
      >
        <div className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && (
              <p id="modal-desc" className="muted" style={{ marginTop: 6 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR
   ═══════════════════════════════════════════════════════════════ */

type AvatarSize = 'tiny' | 'small' | 'medium';

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  src?: string;
  alt?: string;
  status?: 'online' | 'offline' | 'away';
};

export function Avatar({
  initials,
  size = 'small',
  src,
  alt,
  status,
}: AvatarProps) {
  const sizeClass = size !== 'medium' ? `avatar--${size}` : '';

  const sizeMap: Record<AvatarSize, number> = {
    tiny: 28,
    small: 34,
    medium: 42,
  };

  const dim = sizeMap[size];

  return (
    <span
      className={`avatar ${sizeClass}`}
      style={{ width: dim, height: dim, position: 'relative' }}
      aria-label={alt ?? initials}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? initials}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        initials
      )}

      {status && (
        <span
          aria-label={status}
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: size === 'tiny' ? 8 : 10,
            height: size === 'tiny' ? 8 : 10,
            borderRadius: '50%',
            border: '2px solid var(--bg)',
            background:
              status === 'online'
                ? '#16a34a'
                : status === 'away'
                  ? '#f59e0b'
                  : '#64748b',
          }}
        />
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR STACK
   ═══════════════════════════════════════════════════════════════ */

export function AvatarStack({
  children,
  max = 4,
}: {
  children: ReactNode[];
  max?: number;
}) {
  const visible = children.slice(0, max);
  const overflow = children.length - max;

  return (
    <div className="avatar-stack">
      {visible}
      {overflow > 0 && (
        <span className="avatar avatar--tiny" style={{ width: 28, height: 28 }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPINNER (standalone)
   ═══════════════════════════════════════════════════════════════ */

export function Spinner({
  size = 44,
  label = 'Loading',
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div
      className="spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════ */

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'success',
}: {
  value: number;
  max?: number;
  label?: string;
  tone?: BadgeTone;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const colorMap: Record<BadgeTone, string> = {
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#3b82f6',
    neutral: '#64748b',
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
          }}
        >
          <span className="muted">{label}</span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        style={{
          width: '100%',
          height: 6,
          borderRadius: 999,
          background: 'rgba(148, 163, 184, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: colorMap[tone],
            transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}