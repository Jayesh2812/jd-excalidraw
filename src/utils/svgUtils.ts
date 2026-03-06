/**
 * SVG utility functions for optimization
 */

/**
 * Compress SVG string by removing unnecessary content
 * This is a lightweight compression without external dependencies
 */
export function compressSvg(svgString: string): string {
  if (!svgString) return svgString

  let compressed = svgString

  // Remove XML declaration if present
  compressed = compressed.replace(/<\?xml[^>]*\?>/gi, '')

  // Remove comments
  compressed = compressed.replace(/<!--[\s\S]*?-->/g, '')

  // Remove unnecessary whitespace between tags
  compressed = compressed.replace(/>\s+</g, '><')

  // Remove leading/trailing whitespace
  compressed = compressed.trim()

  // Remove empty/redundant attributes
  compressed = compressed.replace(/\s+(id|class)=""/g, '')

  // Simplify number precision (reduce decimal places)
  compressed = compressed.replace(/(\d+\.\d{4})\d+/g, '$1')

  // Remove metadata tag content (Excalidraw adds this)
  compressed = compressed.replace(/<metadata>[\s\S]*?<\/metadata>/gi, '<metadata/>')

  // Remove empty style tags
  compressed = compressed.replace(/<style[^>]*>\s*<\/style>/gi, '')

  // Remove Excalidraw source comments
  compressed = compressed.replace(/<!--\s*svg-source:excalidraw\s*-->/gi, '')

  return compressed
}

/**
 * Get approximate size of string in bytes
 */
export function getStringSize(str: string): number {
  return new Blob([str]).size
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
