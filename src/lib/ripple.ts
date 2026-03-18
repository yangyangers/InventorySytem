// Ripple effect utility for buttons
export function addRipple(e: React.MouseEvent<HTMLElement>) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = e.clientX - rect.left - size / 2
  const y = e.clientY - rect.top - size / 2

  const ripple = document.createElement('span')
  ripple.classList.add('ripple-wave')
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;position:absolute;border-radius:50%;pointer-events:none;`
  btn.appendChild(ripple)
  ripple.addEventListener('animationend', () => ripple.remove())
}
