interface LogoProps {
  size?: number
  showText?: boolean
}

export function Logo({ size = 32, showText = true }: LogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background */}
        <rect width="512" height="512" rx="96" fill="#0a0a0a" />

        {/* Open book / M shape */}
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Left side of M / book spine */}
          <path d="M140 360 L140 152 L256 232 L372 152 L372 360" />

          {/* Center line (pen/pencil) */}
          <line x1="256" y1="232" x2="256" y2="360" />
        </g>

        {/* Pen tip dot */}
        <circle cx="256" cy="380" r="14" fill="#ffffff" />
      </svg>

      {showText && (
        <span
          style={{
            fontSize: size * 0.75,
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          Monobook
        </span>
      )}
    </div>
  )
}
