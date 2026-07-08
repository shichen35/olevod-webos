/*
 * Image with a size-suffixed thumbnail request and a two-step fallback chain:
 *   sized thumbnail -> original image -> solid placeholder block (first letter).
 * Fills a fixed-size container so the card never jitters while the image loads.
 */
import { useState } from 'react'
import { imageUrl } from '../api/olevod.js'

export default function Thumb({ pic, alt = '', size = '384x560' }) {
  // 0 = sized thumbnail, 1 = original image, 2 = placeholder block
  const [stage, setStage] = useState(0)

  if (!pic || stage === 2) {
    return (
      <div className="thumb thumb-fallback" aria-label={alt}>
        {(alt || '?').slice(0, 1)}
      </div>
    )
  }

  const src = stage === 0 ? imageUrl(pic, size) : imageUrl(pic)
  return (
    <img
      className="thumb"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  )
}
