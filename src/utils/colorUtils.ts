/**
 * Color utility functions for preview generation
 */

/**
 * Parse any color format to RGB values
 * Supports: #rgb, #rrggbb, rgb(), rgba(), hsl(), hsla(), named colors
 */
export function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'transparent') return null

  // Remove whitespace
  color = color.trim().toLowerCase()

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    
    // 3-digit hex (#rgb)
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16)
      const g = parseInt(hex[1] + hex[1], 16)
      const b = parseInt(hex[2] + hex[2], 16)
      return { r, g, b }
    }
    
    // 6-digit hex (#rrggbb)
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return { r, g, b }
    }
    
    // 8-digit hex with alpha (#rrggbbaa)
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return { r, g, b }
    }
  }

  // Handle rgb() and rgba()
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    }
  }

  // Handle hsl() and hsla()
  const hslMatch = color.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/)
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10) / 360
    const s = parseInt(hslMatch[2], 10) / 100
    const l = parseInt(hslMatch[3], 10) / 100
    return hslToRgb(h, s, l)
  }

  // Handle common named colors
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  }

  if (namedColors[color]) {
    return namedColors[color]
  }

  return null
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Calculate relative luminance of a color (0-1)
 * Based on WCAG 2.0 formula
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Check if a color is dark (luminance < 0.5)
 * Handles multiple color formats
 */
export function isColorDark(color: string): boolean {
  const rgb = parseColorToRgb(color)
  if (!rgb) return false
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
  return luminance < 0.5
}

/**
 * Convert a dark color to a light equivalent
 * Returns white for dark colors, original for light colors
 */
export function convertToLightColor(color: string): string {
  if (isColorDark(color)) {
    return '#ffffff'
  }
  return color
}

/**
 * Convert element colors for dark theme preview
 */
export function convertElementColorsForPreview(element: any): any {
  const clone = { ...element }
  
  // Convert dark stroke colors to white
  if (clone.strokeColor && isColorDark(clone.strokeColor)) {
    clone.strokeColor = '#ffffff'
  }
  
  // Convert dark background colors to light gray (but keep transparent)
  if (clone.backgroundColor && clone.backgroundColor !== 'transparent' && isColorDark(clone.backgroundColor)) {
    clone.backgroundColor = '#cccccc'
  }
  
  return clone
}
