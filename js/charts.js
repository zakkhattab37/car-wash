import { esc, num } from './utils.js';
export const colors = ['#116C78', '#295C98', '#734EA1', '#99600B', '#0D719F', '#487023', '#A13A64', '#566974'];
const mounted = [];
export const legend = series => '<div class="chart-legend">' + series.map(item => '<span><i class="dot" style="background:' + item.color + '"></i>' + esc(item.label) + '</span>').join('') + '</div>';
export function clearCharts() {
  mounted.splice(0).forEach(dispose => dispose());
}
export function chart(canvas, type, labels, series, unit = '') {
  if (!canvas) return;
  const styles = getComputedStyle(canvas);
  const palette = {
    panel: styles.getPropertyValue('--surface-panel').trim(),
    grid: styles.getPropertyValue('--border-subtle').trim(),
    ink: styles.getPropertyValue('--ink-secondary').trim(),
    border: styles.getPropertyValue('--border-control').trim(),
    tooltip: styles.getPropertyValue('--ink-primary').trim()
  };
  if (globalThis.Chart) {
    const isRing = type === 'doughnut';
    const instance = new Chart(canvas, {
      type, data: { labels, datasets: series.map(item => ({
        label: item.label, data: item.data, borderColor: isRing ? palette.panel : item.color,
        backgroundColor: isRing ? colors : type === 'line' ? item.color + '20' : item.color,
        pointBackgroundColor: item.color, pointRadius: 2, borderWidth: 2, tension: .34,
        fill: type === 'line', pointHoverRadius: 5, borderRadius: type === 'bar' ? 4 : 0
      })) },
      options: {
        responsive: true, maintainAspectRatio: false, locale: 'ar-EG', cutout: '77%', animation: { duration: 220 },
        interaction: { intersect: isRing, mode: isRing ? 'nearest' : 'index' },
        plugins: { legend: { display: false }, tooltip: { rtl: true, backgroundColor: palette.panel, titleColor: palette.tooltip, bodyColor: palette.tooltip, borderColor: palette.border, borderWidth: 1, callbacks: {
          label: context => (isRing ? context.label : context.dataset.label) + ' · ' + num(isRing ? context.raw : context.parsed.y) + (unit ? ' ' + unit : '')
        } } },
        scales: isRing ? undefined : {
          x: { reverse: true, grid: { display: false }, ticks: { color: palette.ink, maxTicksLimit: 8, font: { family: 'Cairo, Tahoma' } } },
          y: { beginAtZero: true, grid: { color: palette.grid }, border: { display: false, dash: [4, 4] },
            ticks: { color: palette.ink, maxTicksLimit: 5, callback: value => num(value) } }
        }
      }
    });
    mounted.push(() => instance.destroy());
    return;
  }
  fallback(canvas, type, labels, series, unit, palette);
}

function fallback(canvas, type, labels, series, unit, palette) {
  const context = canvas.getContext('2d');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  canvas.parentElement.append(tip);
  let width, height, hit = [], ring = [];
  function paint() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    if (width < 1 || height < 1) return;
    const ratio = devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (type === 'doughnut') {
      const values = series[0].data;
      const total = values.reduce((a, b) => a + b, 0);
      const radius = Math.min(width, height) * .405;
      context.lineWidth = Math.max(10, radius * .23);
      ring = [];
      let start = -Math.PI / 2;
      (total ? values : [1]).forEach((value, index) => {
        if (!value) return;
        const size = value / (total || 1) * 2 * Math.PI;
        const end = start + size;
        const gap = Math.min(.035, size / 4);
        context.beginPath();
        context.arc(width / 2, height / 2, radius, start + gap, end - gap);
        context.strokeStyle = total ? colors[index % colors.length] : palette.grid;
        context.lineCap = 'butt';
        context.stroke();
        if (total) ring.push({ start, end, index, radius });
        start = end;
      });
      return;
    }
    const pad = { left: 40, right: 14, top: 13, bottom: 27 };
    const plot = { width: width - pad.left - pad.right, height: height - pad.top - pad.bottom };
    const highest = Math.max(1, ...series.flatMap(item => item.data));
    const magnitude = 10 ** Math.floor(Math.log10(highest));
    const max = Math.ceil(highest / magnitude * 2) * magnitude / 2;
    const spacing = plot.width / Math.max(1, labels.length - 1);
    const scaleY = value => pad.top + plot.height * (1 - value / max);
    const x = index => width - pad.right - spacing * index;
    hit = labels.map((_, index) => x(index));
    context.font = '11px Cairo, Tahoma, sans-serif';
    context.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4;
      const y = scaleY(value);
      context.beginPath(); context.setLineDash([3, 4]); context.strokeStyle = palette.grid; context.lineWidth = 1;
      context.moveTo(pad.left - 2, y); context.lineTo(width - pad.right + 2, y); context.stroke();
      context.fillStyle = palette.ink; context.fillText(num(value), pad.left - 7, y + 3);
    }
    context.setLineDash([]);
    context.textAlign = 'center';
    const step = Math.max(1, Math.ceil(labels.length / (width < 480 ? 5 : 8)));
    labels.forEach((label, index) => { if (index % step === 0) context.fillText(label, x(index), height - 8); });
    series.forEach((item, dataset) => {
      const points = item.data.map((value, index) => [x(index), scaleY(value)]);
      if (type === 'bar') {
        const bar = Math.min(12, spacing / (series.length + 2));
        context.fillStyle = item.color;
        points.forEach(([a, b]) => context.fillRect(a + (dataset - series.length / 2) * bar, b, bar - 2, scaleY(0) - b));
        return;
      }
      if (!points.length) return;
      function trace() {
        context.beginPath();
        context.moveTo(...points[0]);
        for (let i = 1; i < points.length; i++) {
          const [px, py] = points[i - 1], [nx, ny] = points[i];
          const middle = (px + nx) / 2;
          context.bezierCurveTo(middle, py, middle, ny, nx, ny);
        }
      }
      trace();
      context.lineTo(points.at(-1)[0], scaleY(0)); context.lineTo(points[0][0], scaleY(0)); context.closePath();
      const fill = context.createLinearGradient(0, 0, 0, scaleY(0));
      fill.addColorStop(0, item.color + '3d'); fill.addColorStop(1, item.color + '04');
      context.fillStyle = fill; context.fill();
      trace(); context.strokeStyle = item.color; context.lineWidth = 2; context.stroke();
      if (points.length <= 10) for (const [a, b] of points) {
        context.beginPath(); context.arc(a, b, 2.6, 0, Math.PI * 2);
        context.fillStyle = palette.panel; context.fill(); context.stroke();
      }
    });
  }
  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  const hover = event => {
    const x = event.offsetX, y = event.offsetY;
    let index;
    if (type === 'doughnut') {
      const dx = x - width / 2, dy = y - height / 2;
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += 2 * Math.PI;
      index = ring.find(item => Math.abs(Math.hypot(dx, dy) - item.radius) < 12 && angle >= item.start && angle <= item.end)?.index;
    } else if (hit.length) {
      index = hit.reduce((best, point, i) => Math.abs(point - x) < Math.abs(hit[best] - x) ? i : best, 0);
    }
    tip.hidden = index === undefined;
    if (index === undefined) return;
    tip.textContent = labels[index] + ' · ' + series.map(item => (type === 'doughnut' ? '' : item.label + ' ') + num(item.data[index]) + ' ' + unit).join(' / ');
    tip.style.left = Math.max(0, Math.min(width - tip.offsetWidth, x + 9)) + 'px';
    tip.style.top = Math.max(0, y - 34) + 'px';
  };
  const leave = () => { tip.hidden = true; };
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerleave', leave);
  mounted.push(() => { observer.disconnect(); canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerleave', leave); tip.remove(); });
}

