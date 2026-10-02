const COLORS = ['#4A78D1', '#DFFF83', '#FFB68D', '#D0BCFF', '#8DDAB0'];

// A short burst from the given element. Skipped when reduced motion is on.
export function burstConfetti(anchor) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const rect = anchor?.getBoundingClientRect() ?? { left: innerWidth / 2 - 100, top: innerHeight / 3, width: 200 };
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + 60;
  for (let i = 0; i < 46; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.background = COLORS[i % COLORS.length];
    box.appendChild(piece);
    const angle = (Math.PI * 2 * i) / 46 + Math.random() * 0.4;
    const distance = 90 + Math.random() * 160;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.7 - 80;
    piece.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px,${dy + 220}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2200);
}
