/*
 * Image with a size-suffixed thumbnail request and a two-step fallback chain:
 *   sized thumbnail -> original image -> solid placeholder block (first letter).
 * Fills a fixed-size container so the card never jitters while the image loads.
 *
 * `picThumb` is the API's word on which thumbnail the CDN actually has. A
 * quarter of titles have none ('') and some only a square 300x300 one, so the
 * sized request is skipped unless picThumb names exactly that size — otherwise
 * it would 404 (or crop a square into the 2:3 frame). Entries saved before the
 * field existed don't carry it and still try the sized form first.
 */
import { useState } from 'react'
import { imageUrl } from '../api/olevod.js'

export default function Thumb({ pic, picThumb, alt = '', size = '384x560' }) {
  // 0 = sized thumbnail, 1 = original image, 2 = placeholder block
  const [stage, setStage] = useState(() =>
    picThumb === undefined || imageUrl(picThumb) === imageUrl(pic, size) ? 0 : 1,
  )

  if (!pic || stage === 2) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-elev text-display text-fg-3" aria-label={alt}>
        {(alt || '?').slice(0, 1)}
      </div>
    )
  }

  const src = stage === 0 ? imageUrl(pic, size) : imageUrl(pic)
  return (
    <img
      className="h-full w-full object-cover"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  )
}
