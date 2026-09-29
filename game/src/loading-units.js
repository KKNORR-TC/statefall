import frames from './rendering/classic-assets/directional-metadata.json';

const units = [
  ['fighter', 'Fighter', new URL('./rendering/classic-assets/fighter-directions.png', import.meta.url).href],
  ['battleship', 'Battleship', new URL('./rendering/classic-assets/battleship-directions.png', import.meta.url).href],
  ['bomber', 'Bomber', new URL('./rendering/classic-assets/bomber-directions.png', import.meta.url).href],
  ['sub', 'Submarine', new URL('./rendering/classic-assets/sub-directions.png', import.meta.url).href],
  ['truck', 'Supply truck', new URL('./rendering/classic-assets/truck-directions.png', import.meta.url).href],
  ['carrier', 'Troop transport', new URL('./rendering/classic-assets/carrier-directions.png', import.meta.url).href]
];

// Reuse the battlefield's artwork without waiting for the game module to load.
// This showcase never participates in startup readiness or simulation state.
export function startLoadingUnits(container) {
  const canvas = container?.querySelector('canvas');
  const caption = container?.querySelector('figcaption');
  const context = canvas?.getContext('2d');
  if (!context || !caption) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false, timer = 0, index = 0, pending;
  function show() {
    if (stopped) return;
    const [key, name, url] = units[index];
    index = (index + 1) % units.length;
    const image = pending = new Image();
    image.onload = () => {
      if (stopped) return;
      const [x, y, width, height] = frames[key].frames[1];
      const scale = Math.min((canvas.width - 48) / width, (canvas.height - 32) / height);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, x, y, width, height,
        (canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2,
        width * scale, height * scale);
      caption.textContent = name;
      container.classList.add('ready');
      clearTimeout(timer);
      if (!motion.matches) timer = setTimeout(show, 3000);
    };
    image.onerror = () => { if (!stopped) timer = setTimeout(show, 3000); };
    image.src = url;
  }
  function motionChanged() {
    clearTimeout(timer);
    if (!motion.matches) timer = setTimeout(show, 3000);
  }
  motion.addEventListener('change', motionChanged);
  show();
  return () => {
    stopped = true;
    clearTimeout(timer);
    motion.removeEventListener('change', motionChanged);
    if (pending) pending.onload = pending.onerror = null;
  };
}
