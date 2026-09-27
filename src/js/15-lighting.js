/* ================= time-of-day lighting ================= */
const SKY = [
  [0, [18, 26, 70], [34, 40, 96], .34], [5, [40, 40, 100], [120, 90, 140], .3], [6.5, [255, 160, 140], [255, 210, 160], .3],
  [8.5, [170, 210, 255], [255, 240, 215], .18], [12, [190, 225, 255], [225, 240, 255], .12], [16, [255, 200, 140], [255, 230, 185], .2],
  [18, [255, 140, 110], [255, 190, 120], .32], [19.5, [150, 100, 190], [255, 140, 120], .32], [21, [60, 60, 150], [110, 80, 160], .3],
  [24, [18, 26, 70], [34, 40, 96], .34]
];
function applyLighting() {
  document.body.classList.toggle("lit", !!state.lighting);
  if (!state.lighting) return;
  const h = hourNow(); let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], k = (h - a[0]) / (b[0] - a[0]);
  const mix = (x, y) => x.map((v, j) => Math.round(v + (y[j] - v) * k));
  const top = mix(a[1], b[1]), bot = mix(a[2], b[2]), o = a[3] + (b[3] - a[3]) * k;
  const rs = document.documentElement.style;
  rs.setProperty("--sky-a", `rgb(${top})`); rs.setProperty("--sky-b", `rgb(${bot})`); rs.setProperty("--sky-o", o.toFixed(3));
}

