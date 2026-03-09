import './AnimatedBackground.css'

export function AnimatedBackground() {
  return (
    <div className="animated-background">
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className={`blob blob-${i + 1}`} />
      ))}
    </div>
  )
}
