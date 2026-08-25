import React, { useId } from 'react'

interface LogoProps {
  size?: number
  showWordmark?: boolean
  subtitle?: string
  inverted?: boolean
  className?: string
}

export function Logo({
  size = 32,
  showWordmark = false,
  subtitle,
  inverted = false,
  className = '',
}: LogoProps) {
  const uid = useId().replace(/:/g, '')
  const bgId = `docrh-bg-${uid}`
  const glossId = `docrh-gloss-${uid}`
  const lensId = `docrh-lens-${uid}`

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        role={showWordmark ? undefined : 'img'}
        aria-hidden={showWordmark ? true : undefined}
        aria-label={showWordmark ? undefined : 'DocRH'}
      >
        <defs>
          <linearGradient id={bgId} x1="2" y1="0" x2="30" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="0.55" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id={glossId} x1="8" y1="6" x2="22" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E0E7FF" />
          </linearGradient>
          <linearGradient id={lensId} x1="17" y1="16" x2="29" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A5B4FC" />
            <stop offset="1" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>

        <rect width="32" height="32" rx="9" fill={`url(#${bgId})`} />

        {/* Documento */}
        <path
          d="M8.4 8.1c0-.9.73-1.63 1.63-1.63h7.05L21.6 11v12.15c0 .9-.73 1.63-1.63 1.63H10.03c-.9 0-1.63-.73-1.63-1.63V8.1z"
          fill={`url(#${glossId})`}
        />
        <path d="M17.08 6.47v3.55c0 .5.4.9.9.9h3.62" fill="#C7D2FE" />

        {/* Linhas do documento */}
        <rect x="10.7" y="14.1" width="7.3" height="1.35" rx="0.67" fill="#4338CA" opacity="0.38" />
        <rect x="10.7" y="17.15" width="5.2" height="1.35" rx="0.67" fill="#4338CA" opacity="0.24" />

        {/* Lupa — consulta inteligente */}
        <circle
          cx="21.35"
          cy="21.45"
          r="5.15"
          fill={`url(#${lensId})`}
          fillOpacity="0.28"
          stroke="white"
          strokeWidth="1.7"
        />
        <circle cx="21.35" cy="21.45" r="2.3" fill="none" stroke="white" strokeWidth="1.45" />
        <path d="M25.15 25.25L28.15 28.25" stroke="white" strokeWidth="2.05" strokeLinecap="round" />

        {/* Brilho de IA */}
        <path
          d="M24.35 7.55l.52 1.28 1.35.38-1.35.38-.52 1.28-.52-1.28-1.35-.38 1.35-.38z"
          fill="#BFDBFE"
        />
      </svg>

      {showWordmark && (
        <div className="min-w-0 leading-tight">
          <p
            className={`font-semibold tracking-tight truncate ${
              inverted ? 'text-white' : 'text-[var(--text-primary)]'
            }`}
            style={{ fontSize: size >= 40 ? 20 : size >= 32 ? 14 : 13 }}
          >
            DocRH
          </p>
          {subtitle && (
            <p
              className={`truncate ${
                inverted ? 'text-white/70' : 'text-[var(--text-muted)]'
              }`}
              style={{ fontSize: size >= 40 ? 13 : 12 }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
