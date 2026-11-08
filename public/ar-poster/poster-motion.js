const TAU = Math.PI * 2;
const CYCLE_SECONDS = 6;

export function posterPose(seconds) {
  const phase = TAU * seconds / CYCLE_SECONDS;
  return {
    x: .023 * Math.sin(phase + .65),
    y: .049 * Math.sin(phase),
    roll: .087 * Math.sin(phase + .6),
    stars: .87 + .13 * Math.cos(phase * 2),
  };
}

function sparkle(ctx, x, y, size, color, opacity) {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * .14, y - size * .16, x + size * .68, y);
  ctx.quadraticCurveTo(x + size * .14, y + size * .16, x, y + size);
  ctx.quadraticCurveTo(x - size * .14, y + size * .16, x - size * .68, y);
  ctx.quadraticCurveTo(x - size * .14, y - size * .16, x, y - size);
  ctx.fill();
}

export function drawPosterEffects(ctx, seconds) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  // Light trails stay in the margins so they never cover the event details.
  const routes = [
    { start: .06, from: [.07, .25], to: [.18, .13], color: '#56c6b5' },
    { start: .52, from: [.94, .33], to: [.86, .17], color: '#ffd400' },
  ];
  const cycle = seconds / CYCLE_SECONDS % 1;
  for (const { start, from, to, color } of routes) {
    const t = ((cycle - start + 1) % 1) / .29;
    if (t >= 1) continue;
    const envelope = Math.sin(Math.PI * t);
    for (let i = 12; i >= 0; i--) {
      const p = Math.max(0, t - i * .027);
      const x = (from[0] + (to[0] - from[0]) * p) * width;
      const y = (from[1] + (to[1] - from[1]) * p) * height;
      sparkle(ctx, x, y, width * (.012 - i * .00072), i === 0 ? '#fffef6' : color, envelope * (1 - i / 14));
    }
  }
  // Small glints light up near the brush, palette and existing constellation.
  const glints = [[.24,.43], [.27,.40], [.74,.59], [.79,.56], [.12,.45], [.86,.46], [.38,.23], [.67,.15]];
  for (let i = 0; i < glints.length; i++) {
    const [x,y] = glints[i];
    const pulse = Math.max(0, Math.cos(TAU * (2 * cycle + i * .18))) ** 3;
    sparkle(ctx, x * width, y * height, width * (.007 + .016 * pulse), i % 2 ? '#ffd400' : '#fffef6', .92 * pulse);
  }
  ctx.restore();
}

export async function mountPosterPreview(figure, reducedMotion) {
  if (reducedMotion.matches) return;
  const canvas = figure.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const response = await fetch('poster-v2-layers.json');
  if (!response.ok) return;
  const { layers } = await response.json();
  const artwork = await Promise.all(layers.map(async ({image, bounds}) => {
    const img = new Image();
    img.src = image;
    await img.decode();
    return { img, bounds };
  }));
  const effects = document.createElement('canvas');
  effects.width = canvas.width;
  effects.height = canvas.height;
  const effectContext = effects.getContext('2d');
  if (!effectContext) return;
  let frame = 0;
  function render(now) {
    const seconds = now / 1000;
    const pose = posterPose(seconds);
    const width = canvas.width;
    ctx.clearRect(0, 0, width, canvas.height);
    artwork.forEach(({img, bounds}, i) => {
      const [x,y,w,h] = bounds.map(value => value * width);
      ctx.save();
      if (i === 1) ctx.globalAlpha = pose.stars;
      if (i === 4) {
        ctx.translate(x + w / 2 + pose.x * width, y + h / 2 - pose.y * width);
        ctx.rotate(-pose.roll);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
      ctx.restore();
    });
    drawPosterEffects(effectContext, seconds);
    ctx.drawImage(effects, 0, 0);
    frame = requestAnimationFrame(render);
  }
  const observer = new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(frame);
    if (entry.isIntersecting && !reducedMotion.matches) {
      render(performance.now());
      figure.classList.add('is-animated');
    }
  });
  observer.observe(figure);
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) figure.classList.remove('is-animated');
    else {
      observer.unobserve(figure);
      observer.observe(figure);
    }
  });
}
