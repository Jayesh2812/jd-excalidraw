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

        {/* M shape with book bottom */}
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* M shape */}
          <path d="M140 310 L140 122 L256 202 L372 122 L372 310" />
          {/* Center spine */}
          <line x1="256" y1="202" x2="256" y2="390" />
          {/* Book bottom */}
          <path d="M140 312 L256 390 L372 312" />
        </g>
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
