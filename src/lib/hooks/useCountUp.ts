'use client'

import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'

export function useCountUp(target: number, reducedMotion: boolean, delay = 0) {
  const [value, setValue] = useState(reducedMotion ? target : 0)
  useEffect(() => {
    if (reducedMotion) { setValue(target); return }
    const controls = animate(0, target, {
      duration: 1.4,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [target, reducedMotion, delay])
  return value
}
