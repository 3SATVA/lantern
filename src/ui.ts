export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export function hit(rects: Rect[], x: number, y: number): Rect | null {
  for (const r of rects) {
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
  }
  return null;
}

export function touchButtons(w: number, h: number): Rect[] {
  return [
    { id: "pause", x: w - 58, y: 14, w: 44, h: 28, label: "II" },
    { id: "spell", x: w - 116, y: h - 70, w: 48, h: 48, label: "SPL" },
    { id: "use", x: w - 60, y: h - 70, w: 48, h: 48, label: "E" },
  ];
}

export function stackButtons(w: number, h: number, labels: { id: string; label: string }[], width = 220): Rect[] {
  const height = 36;
  const gap = 10;
  const total = labels.length * height + (labels.length - 1) * gap;
  let y = h / 2 - total / 2 + 36;
  const x = w / 2 - width / 2;
  return labels.map((item) => {
    const rect = { id: item.id, x, y, w: width, h: height, label: item.label };
    y += height + gap;
    return rect;
  });
}
