import { useState, useRef } from 'react'
import type { ReactNode, CSSProperties } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  maxTilt?: number
  scale?: number
  onClick?: () => void
}

export function TiltCard({
  children,
  className,
  style,
  maxTilt = 8,
  scale = 1.05,
  onClick,
}: TiltCardProps) {
  const [transform, setTransform] = useState('')
  const [transition, setTransition] = useState('transform 0.2s ease-out')
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Calculate distance from center (-1 to 1)
    const percentX = (e.clientX - centerX) / (rect.width / 2)
    const percentY = (e.clientY - centerY) / (rect.height / 2)

    // Calculate tilt angles (inverted for natural feel)
    const rotateX = -percentY * maxTilt
    const rotateY = percentX * maxTilt

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`)
    setTransition('transform 0.05s ease-out')
  }

  const handleMouseLeave = () => {
    setTransform('')
    setTransition('transform 0.2s ease-out')
  }

  return (
    <div
      ref={cardRef}
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform,
        transition,
        transformStyle: 'preserve-3d',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  )
}
