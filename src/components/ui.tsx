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
  createContext,
  useContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type CSSProperties,
  forwardRef,
  type ForwardedRef,
} from 'react';
import { AlertCircle, Check, ChevronDown, Eye, EyeOff, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
type AvatarSize = 'tiny' | 'small' | 'medium' | 'large';

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS (consumed in JS for components that need them)
   ═══════════════════════════════════════════════════════════════ */

const tokens = {
  toneColors: {
    success: { bg: 'var(--sage-light)', text: 'var(--sage)', border: 'rgba(77,124,82,0.22)' },
    warning: { bg: 'var(--gold-light)', text: 'var(--gold)', border: 'rgba(168,120,50,0.22)' },
    danger: { bg: 'rgba(184,50,50,0.10)', text: 'var(--danger)', border: 'rgba(184,50,50,0.20)' },
    info: { bg: 'rgba(60,100,160,0.10)', text: 'var(--info)', border: 'rgba(60,100,160,0.18)' },
    neutral: { bg: 'var(--slate-light)', text: 'var(--muted)', border: 'var(--line)' },
  } satisfies Record<Tone, { bg: string; text: string; border: string }>,

  statusColors: {
    online: 'var(--sage)',
    away: 'var(--gold)',
    busy: 'var(--danger)',
    offline: 'var(--muted)',
  } as Record<string, string>,

  avatarSizes: {
    tiny: 28,
    small: 34,
    medium: 44,
    large: 56,
  } satisfies Record<AvatarSize, number>,
} as const;

/* ═══════════════════════════════════════════════════════════════
   UTILITY — class name builder
   ═══════════════════════════════════════════════════════════════ */

function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
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
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          'button',
          `button--${variant}`,
          `button--${size}`,
          fullWidth && 'button--full-width',
          loading && 'button--loading',
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="button__spinner" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ animation: 'spin 700ms linear infinite', display: 'block' }}
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="2.5"
              />
              <path
                d="M8 2a6 6 0 0 1 6 6"
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

        <span className="button__label">{children}</span>

        {!loading && trailingIcon ? (
          <span className="button__icon" aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   ICON BUTTON
   ═══════════════════════════════════════════════════════════════ */

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; // required for accessibility
  size?: 'sm' | 'md';
  variant?: 'default' | 'ghost' | 'danger';
  loading?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      size = 'md',
      variant = 'default',
      loading = false,
      disabled,
      children,
      className = '',
      style,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn('icon-button', className)}
        aria-label={label}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        style={{
          ...(size === 'sm' && { width: 32, height: 32 }),
          ...(variant === 'danger' && {
            color: 'var(--danger)',
            borderColor: 'rgba(184,50,50,0.20)',
          }),
          ...(variant === 'ghost' && {
            borderColor: 'transparent',
            background: 'transparent',
            boxShadow: 'none',
          }),
          ...style,
        }}
        {...props}
      >
        {loading ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ animation: 'spin 700ms linear infinite' }}
          >
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
            <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          children
        )}
      </button>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════ */

type CardProps = {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  as?: 'section' | 'div' | 'article' | 'aside';
  onClick?: () => void;
  style?: CSSProperties;
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
  'aria-busy'?: boolean | 'true' | 'false';
  onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
};

export function Card({
  children,
  className = '',
  hoverable = false,
  as: Tag = 'section',
  onClick,
  style,
  role,
  tabIndex,
  'aria-label': ariaLabel,
  'aria-busy': ariaBusy,
  onKeyDown,
}: CardProps) {
  return (
    <Tag
      className={cn('card', hoverable && 'card--hoverable', className)}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={style}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BADGE
   ═══════════════════════════════════════════════════════════════ */

type BadgeProps = {
  tone?: Tone;
  pulse?: boolean;
  dot?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
  style?: CSSProperties;
};

export function Badge({
  tone = 'neutral',
  pulse = false,
  dot = false,
  size,
  children,
  style,
}: BadgeProps) {
  return (
    <span
      className={cn('badge', `badge--${tone}`, pulse && 'badge--pulse')}
      style={{
        ...(size === 'sm' && { fontSize: '0.62rem', padding: '1px 6px' }),
        ...style,
      }}
    >
      {(pulse || dot) && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
            display: 'inline-block',
            ...(pulse && { animation: 'pulse-dot 2s ease-in-out infinite' }),
          }}
        />
      )}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PILL
   ═══════════════════════════════════════════════════════════════ */

export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   FIELD WRAPPER
   ═══════════════════════════════════════════════════════════════ */

type FieldWrapperProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  hideLabel?: boolean;
};

function FieldWrapper({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
  hideLabel = false,
}: FieldWrapperProps) {
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('field', error && 'field--error')}>
      <label
        className="field__label"
        htmlFor={id}
        style={hideLabel ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' } : undefined}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: 'var(--danger)', marginLeft: 2 }}
          >
            *
          </span>
        )}
        {optional && (
          <span className="muted" style={{ fontSize: '0.76rem', fontWeight: 400, marginLeft: 6 }}>
            (optional)
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
        <span
          className="field__error"
          id={errorId}
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={13} aria-hidden="true" />
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
  optional?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  hideLabel?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      hint,
      error,
      required,
      optional,
      leadingIcon,
      trailingIcon,
      hideLabel = false,
      className = '',
      type = 'text',
      ...props
    },
    ref
  ) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const hintId = hint && !error ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    // Password visibility toggle
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const hasTrailing = Boolean(trailingIcon) || isPassword;
    const hasLeading = Boolean(leadingIcon);

    return (
      <FieldWrapper
        id={id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        optional={optional}
        hideLabel={hideLabel}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {hasLeading && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 13,
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={resolvedType}
            className={cn('input', className)}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={required}
            style={{
              paddingLeft: hasLeading ? 40 : undefined,
              paddingRight: hasTrailing ? 40 : undefined,
            }}
            {...props}
          />

          {hasTrailing && (
            <span
              style={{
                position: 'absolute',
                right: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isPassword ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color var(--duration-fast) var(--ease-smooth)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              ) : (
                <span aria-hidden="true" style={{ color: 'var(--muted)', display: 'flex' }}>
                  {trailingIcon}
                </span>
              )}
            </span>
          )}
        </div>
      </FieldWrapper>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   TEXTAREA
   ═══════════════════════════════════════════════════════════════ */

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  maxLength?: number;
  showCount?: boolean;
  minRows?: number;
  autoResize?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      hint,
      error,
      required,
      optional,
      showCount = false,
      maxLength,
      minRows = 3,
      autoResize = false,
      className = '',
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const hintId = hint && !error ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    const [charCount, setCharCount] = useState(
      () => String(value ?? defaultValue ?? '').length
    );

    const internalRef = useRef<HTMLTextAreaElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setCharCount(val.length);

        if (autoResize && resolvedRef.current) {
          resolvedRef.current.style.height = 'auto';
          resolvedRef.current.style.height = `${resolvedRef.current.scrollHeight}px`;
        }

        onChange?.(e);
      },
      [onChange, autoResize, resolvedRef]
    );

    const isNearLimit = maxLength && charCount > maxLength * 0.85;
    const isAtLimit = maxLength && charCount >= maxLength;

    return (
      <FieldWrapper
        id={id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        optional={optional}
      >
        <textarea
          ref={resolvedRef}
          id={id}
          className={cn('input input--textarea', className)}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          rows={minRows}
          style={autoResize ? { resize: 'none', overflow: 'hidden' } : undefined}
          {...props}
        />
        {showCount && maxLength && (
          <span
            className="field__hint"
            style={{
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              color: isAtLimit
                ? 'var(--danger)'
                : isNearLimit
                  ? 'var(--gold)'
                  : undefined,
              transition: 'color var(--duration) var(--ease-smooth)',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {charCount}/{maxLength}
          </span>
        )}
      </FieldWrapper>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   SELECT
   ═══════════════════════════════════════════════════════════════ */

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      hint,
      error,
      required,
      optional,
      placeholder,
      className = '',
      children,
      ...props
    },
    ref
  ) {
    const autoId = useId();
    const id = props.id ?? autoId;
    const hintId = hint && !error ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <FieldWrapper
        id={id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        optional={optional}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            ref={ref}
            id={id}
            className={cn('input', className)}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={required}
            style={{ paddingRight: 36, appearance: 'none', WebkitAppearance: 'none' }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 12,
              color: 'var(--muted)',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <ChevronDown size={16} />
          </span>
        </div>
      </FieldWrapper>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   CHECKBOX
   ═══════════════════════════════════════════════════════════════ */

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  description?: string;
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, description, error, className = '', id: propId, ...props }, ref) {
    const autoId = useId();
    const id = propId ?? autoId;
    const descId = description ? `${id}-desc` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className={cn('field', error && 'field--error')}>
        <label
          htmlFor={id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
            <input
              ref={ref}
              id={id}
              type="checkbox"
              className={cn('checkbox-input', className)}
              aria-invalid={error ? true : undefined}
              aria-describedby={[descId, errorId].filter(Boolean).join(' ') || undefined}
              style={{
                width: 18,
                height: 18,
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${error ? 'var(--danger)' : 'rgba(28,26,23,0.25)'}`,
                background: 'var(--surface)',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                transition: 'border-color var(--duration) var(--ease-smooth), background var(--duration) var(--ease-smooth)',
                display: 'grid',
                placeItems: 'center',
              }}
              {...props}
            />
            <Check
              size={11}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                pointerEvents: 'none',
                strokeWidth: 3,
              }}
            />
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span className="field__label" style={{ cursor: 'pointer' }}>
              {label}
            </span>
            {description && (
              <span id={descId} className="field__hint">
                {description}
              </span>
            )}
          </div>
        </label>

        {error && (
          <span
            id={errorId}
            className="field__error"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={13} aria-hidden="true" />
            {error}
          </span>
        )}
      </div>
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   RADIO GROUP
   ═══════════════════════════════════════════════════════════════ */

type RadioOption = { value: string; label: string; description?: string; disabled?: boolean };

type RadioGroupProps = {
  name: string;
  label: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  orientation?: 'vertical' | 'horizontal';
};

export function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  required,
  orientation = 'vertical',
}: RadioGroupProps) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;
  const hintId = hint && !error ? `${groupId}-hint` : undefined;

  return (
    <fieldset
      style={{ border: 'none', padding: 0, margin: 0 }}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
    >
      <legend
        className="field__label"
        style={{ marginBottom: 10 }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>
        )}
      </legend>

      <div
        style={{
          display: 'flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
          gap: orientation === 'horizontal' ? 16 : 8,
          flexWrap: 'wrap',
        }}
      >
        {options.map((option) => {
          const optId = `${groupId}-${option.value}`;
          const isChecked = value === option.value;

          return (
            <label
              key={option.value}
              htmlFor={optId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: option.disabled ? 'not-allowed' : 'pointer',
                opacity: option.disabled ? 0.5 : 1,
                userSelect: 'none',
              }}
            >
              <input
                id={optId}
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                disabled={option.disabled}
                required={required}
                onChange={() => onChange?.(option.value)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `1.5px solid ${isChecked ? 'var(--sienna)' : 'rgba(28,26,23,0.25)'}`,
                  background: 'var(--surface)',
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  flexShrink: 0,
                  marginTop: 2,
                  transition: 'border-color var(--duration) var(--ease-smooth)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              />
              <div style={{ display: 'grid', gap: 2 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 400 }}>{option.label}</span>
                {option.description && (
                  <span className="muted" style={{ fontSize: '0.78rem' }}>{option.description}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {hint && !error && (
        <span id={hintId} className="field__hint" style={{ marginTop: 8, display: 'block' }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field__error" role="alert" aria-live="polite" style={{ marginTop: 8 }}>
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      )}
    </fieldset>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE / SWITCH
   ═══════════════════════════════════════════════════════════════ */

type ToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
};

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  id: propId,
}: ToggleProps) {
  const autoId = useId();
  const id = propId ?? autoId;
  const descId = description ? `${id}-desc` : undefined;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ display: 'grid', gap: 3 }}>
        <label
          htmlFor={id}
          style={{
            fontSize: '0.88rem',
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'var(--text)',
          }}
        >
          {label}
        </label>
        {description && (
          <span id={descId} className="muted" style={{ fontSize: '0.8rem' }}>
            {description}
          </span>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          background: checked ? 'var(--sienna)' : 'var(--cream-3)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          position: 'relative',
          flexShrink: 0,
          transition: 'background var(--duration) var(--ease-smooth)',
          boxShadow: checked ? '0 2px 8px rgba(192,97,43,0.28)' : 'inset 0 1px 3px rgba(28,26,23,0.10)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(28,26,23,0.20)',
            transition: 'left var(--duration) var(--ease-bounce)',
          }}
        />
      </button>
    </div>
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
  style?: CSSProperties;
};

export function SkeletonBlock({
  className = '',
  width,
  height,
  radius,
  style,
}: SkeletonBlockProps) {
  return (
    <div
      className={cn('skeleton', className)}
      aria-hidden="true"
      role="presentation"
      style={{
        width: width ?? '100%',
        minHeight: typeof height === 'number' ? height : undefined,
        height: typeof height === 'string' ? height : undefined,
        borderRadius: radius ?? undefined,
        ...style,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON GROUP
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
        <SkeletonBlock key={i} width={widths[i % widths.length]} height={14} />
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
  tone?: Tone;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = 'neutral',
}: EmptyStateProps) {
  const colors = tokens.toneColors[tone];

  return (
    <div className="empty-state" role="status">
      {icon && (
        <div
          className="empty-state__icon"
          style={{
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ display: 'grid', gap: 6, textAlign: 'center' }}>
        <h3>{title}</h3>
        <p className="muted" style={{ maxWidth: '40ch', margin: '0 auto' }}>
          {description}
        </p>
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */

type TabItem = {
  id: string;
  label: string;
  badge?: string | number;
  icon?: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (tabId: string) => void;
  'aria-label'?: string;
};

export function Tabs({
  tabs,
  activeId,
  onChange,
  'aria-label': ariaLabel = 'Section tabs',
}: TabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeIndex = tabs.findIndex((t) => t.id === activeId);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Only cycle through non-disabled tabs
      const navigable = tabs.filter((t) => !t.disabled);
      const currentNav = navigable.findIndex((t) => t.id === activeId);

      let nextNavIndex = currentNav;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextNavIndex = (currentNav + 1) % navigable.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextNavIndex = (currentNav - 1 + navigable.length) % navigable.length;
          break;
        case 'Home':
          e.preventDefault();
          nextNavIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextNavIndex = navigable.length - 1;
          break;
        default:
          return;
      }

      const nextTab = navigable[nextNavIndex];
      onChange(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    },
    [activeId, onChange, tabs]
  );

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled || undefined}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            className={cn('tabs__tab', isActive && 'tabs__tab--active')}
            onClick={() => !tab.disabled && onChange(tab.id)}
          >
            {tab.icon && (
              <span className="button__icon" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span className="tabs__badge" aria-label={`${tab.badge} items`}>
                {tab.badge}
              </span>
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
  closeOnOverlayClick?: boolean;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    // Store current focus and lock body scroll
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Focus the panel after paint
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableSelector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
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
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthMap = { sm: 480, md: 720, lg: 960 };

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div
        className="modal__overlay"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      <div
        ref={panelRef}
        className="modal__panel"
        tabIndex={-1}
        style={{ width: `min(${widthMap[size]}px, 100%)` }}
      >
        <div className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p
                id={descId}
                className="muted"
                style={{ marginTop: 6, fontSize: '0.9rem' }}
              >
                {description}
              </p>
            )}
          </div>
          <IconButton
            label="Close dialog"
            onClick={onClose}
            variant="ghost"
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
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

type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  src?: string;
  alt?: string;
  status?: AvatarStatus;
};

export function Avatar({
  initials,
  size = 'small',
  src,
  alt,
  status,
}: AvatarProps) {
  const dim = tokens.avatarSizes[size];
  const sizeClass = size !== 'medium' ? `avatar--${size}` : '';
  const statusDim = size === 'tiny' ? 8 : size === 'small' ? 10 : 12;

  return (
    <span
      className={cn('avatar', sizeClass)}
      style={{ width: dim, height: dim, position: 'relative' }}
      role="img"
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
        <span aria-hidden="true">{initials}</span>
      )}

      {status && (
        <span
          aria-label={status}
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: statusDim,
            height: statusDim,
            borderRadius: '50%',
            border: '2px solid var(--surface)',
            background: tokens.statusColors[status] ?? 'var(--muted)',
            transition: 'background var(--duration) var(--ease-smooth)',
          }}
        />
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR STACK
   ═══════════════════════════════════════════════════════════════ */

type AvatarStackProps = {
  avatars: AvatarProps[];
  max?: number;
  size?: AvatarSize;
};

export function AvatarStack({ avatars, max = 4, size = 'small' }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;
  const dim = tokens.avatarSizes[size];

  return (
    <div
      className="avatar-stack"
      role="group"
      aria-label={`${avatars.length} member${avatars.length !== 1 ? 's' : ''}`}
    >
      {visible.map((avatar, i) => (
        <Avatar key={i} {...avatar} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className="avatar avatar--small"
          style={{
            width: dim,
            height: dim,
            background: 'var(--slate-light)',
            color: 'var(--muted)',
            fontSize: '0.7rem',
          }}
          aria-label={`and ${overflow} more`}
        >
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
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════ */

type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  indeterminate?: boolean;
};

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'success',
  size = 'md',
  showValue = false,
  indeterminate = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = tokens.toneColors[tone];

  const heightMap = { sm: 4, md: 6, lg: 10 };
  const barHeight = heightMap[size];

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
          }}
        >
          {label && <span className="muted">{label}</span>}
          {showValue && (
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: colors.text,
              }}
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        aria-valuetext={indeterminate ? 'Loading' : `${Math.round(pct)}%`}
        style={{
          width: '100%',
          height: barHeight,
          borderRadius: 999,
          background: colors.bg,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: colors.text,
            width: indeterminate ? '40%' : `${pct}%`,
            transition: indeterminate ? undefined : 'width 600ms var(--ease)',
            animation: indeterminate
              ? 'progress-indeterminate 1.5s ease-in-out infinite'
              : undefined,
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALLOUT / ALERT BANNER
   ═══════════════════════════════════════════════════════════════ */

type CalloutProps = {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
};

export function Callout({
  tone = 'neutral',
  title,
  children,
  icon,
  onDismiss,
}: CalloutProps) {
  const colors = tokens.toneColors[tone];

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: 'var(--text)',
        animation: 'fade-in-up var(--duration-slow) var(--ease) both',
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{
            color: colors.text,
            flexShrink: 0,
            marginTop: 1,
            display: 'flex',
          }}
        >
          {icon}
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        {title && (
          <strong style={{ fontSize: '0.9rem', color: colors.text }}>
            {title}
          </strong>
        )}
        <div className="muted" style={{ fontSize: '0.86rem', lineHeight: 1.65 }}>
          {children}
        </div>
      </div>

      {onDismiss && (
        <IconButton
          label="Dismiss"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          style={{ color: colors.text, flexShrink: 0 }}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIVIDER
   ═══════════════════════════════════════════════════════════════ */

export function Divider({
  label,
  orientation = 'horizontal',
}: {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        style={{
          width: 1,
          alignSelf: 'stretch',
          background: 'var(--line)',
        }}
      />
    );
  }

  if (!label) {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--line)',
          margin: 0,
        }}
      />
    );
  }

  return (
    <div
      role="separator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: 'var(--muted)',
        fontSize: '0.76rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP
   ═══════════════════════════════════════════════════════════════ */

type TooltipProps = {
  content: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export function Tooltip({
  content,
  children,
  placement = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const placementStyles: Record<string, CSSProperties> = {
    top: { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    left: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
    right: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 50,
            ...placementStyles[placement],
            background: 'var(--ink)',
            color: 'var(--parchment)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fade-in-up var(--duration-fast) var(--ease) both',
            pointerEvents: 'none',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DROPDOWN MENU
   ═══════════════════════════════════════════════════════════════ */

type DropdownItem =
  | { type: 'item'; label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: 'divider' }
  | { type: 'label'; text: string };

type DropdownProps = {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  'aria-label'?: string;
};

export function Dropdown({
  trigger,
  items,
  align = 'right',
  'aria-label': ariaLabel = 'Options',
}: DropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const menuId = useId();

  // Close on outside click
  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.removeAttribute('open');
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.removeAttribute('open');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    if (item.type === 'item') {
      item.onClick();
      detailsRef.current?.removeAttribute('open');
    }
  };

  return (
    <details ref={detailsRef} style={{ position: 'relative' }}>
      <summary
        style={{ listStyle: 'none', cursor: 'pointer' }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {trigger}
      </summary>

      <div
        id={menuId}
        role="menu"
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          minWidth: 200,
          padding: 6,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          backdropFilter: 'blur(var(--blur-heavy))',
          WebkitBackdropFilter: 'blur(var(--blur-heavy))',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 40,
          display: 'grid',
          gap: 2,
          animation: 'menu-open var(--duration) var(--ease) both',
        }}
      >
        {items.map((item, i) => {
          if (item.type === 'divider') {
            return (
              <hr
                key={i}
                role="separator"
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--line)',
                  margin: '4px 0',
                }}
              />
            );
          }

          if (item.type === 'label') {
            return (
              <span
                key={i}
                style={{
                  padding: '6px 10px 4px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--muted)',
                }}
              >
                {item.text}
              </span>
            );
          }

          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                padding: '9px 12px',
                border: 'none',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: item.danger ? 'var(--danger)' : 'var(--text)',
                textAlign: 'left',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                fontSize: '0.88rem',
                transition: 'background var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease)',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--slate-light)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(2px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.transform = 'none';
              }}
            >
              {item.icon && (
                <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE FRAME (shared layout wrapper)
   ═══════════════════════════════════════════════════════════════ */

type PageFrameProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: PageFrameProps) {
  const titleId = useId();

  return (
    <div className="page" aria-labelledby={titleId}>
      <header className="page__header">
        <div>
          {eyebrow && (
            <p className="eyebrow eyebrow--subtle" aria-hidden="true">
              {eyebrow}
            </p>
          )}
          <h1 id={titleId} className="page__title">
            {title}
          </h1>
          {description && (
            <p className="page__description">{description}</p>
          )}
        </div>
        {action && <div className="page__action">{action}</div>}
      </header>

      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAT GRID (shared dashboard component)
   ═══════════════════════════════════════════════════════════════ */

type StatItem = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: Tone;
  change?: { value: number; label?: string };
};

type StatGridProps = {
  items: StatItem[];
};

export function StatGrid({ items }: StatGridProps) {
  return (
    <div className="stat-grid" role="list" aria-label="Statistics">
      {items.map((item, i) => {
        const colors = item.tone ? tokens.toneColors[item.tone] : null;
        const isPositiveChange = item.change && item.change.value > 0;

        return (
          <Card
            key={i}
            className="stat-card"
            role="listitem"
            style={{ animationDelay: `${0.05 + i * 0.05}s` } as CSSProperties}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p className="stat-card__label">{item.label}</p>
              {item.icon && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius)',
                    background: colors?.bg ?? 'var(--slate-light)',
                    color: colors?.text ?? 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
              )}
            </div>

            <p
              className="stat-card__value"
              aria-label={`${item.label}: ${item.value}`}
            >
              {item.value}
            </p>

            {item.change && (
              <p
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: isPositiveChange ? 'var(--sage)' : 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                aria-label={`Change: ${item.change.value > 0 ? '+' : ''}${item.change.value}${item.change.label ? ` ${item.change.label}` : ''}`}
              >
                <span aria-hidden="true">{isPositiveChange ? '↑' : '↓'}</span>
                {Math.abs(item.change.value)}
                {item.change.label && (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {item.change.label}
                  </span>
                )}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}