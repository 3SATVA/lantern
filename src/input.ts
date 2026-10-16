export interface Input {
  keys: Set<string>;
  ax: number;
  ay: number;
  aimX: number;
  aimY: number;
  pointerDown: boolean;
  justPressed: Set<string>;
  interact: boolean;
  pause: boolean;
  castPressed: boolean;
  wheel: number;
  spellSlot: number;
  touch: boolean;
  stick: { active: boolean; dx: number; dy: number; ox: number; oy: number };
  uiClick: { x: number; y: number } | null;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  const input: Input = {
    keys: new Set(),
    ax: 0,
    ay: 0,
    aimX: 0,
    aimY: 0,
    pointerDown: false,
    justPressed: new Set(),
    interact: false,
    pause: false,
    castPressed: false,
    wheel: 0,
    spellSlot: -1,
    touch: false,
    stick: { active: false, dx: 0, dy: 0, ox: 0, oy: 0 },
    uiClick: null,
  };

  const setKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (down) {
      if (!input.keys.has(k)) input.justPressed.add(k);
      input.keys.add(k);
      if (k >= "1" && k <= "5") input.spellSlot = Number(k) - 1;
    } else {
      input.keys.delete(k);
    }
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k.toLowerCase()) ||
      k.startsWith("Arrow")
    ) {
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", (e) => {
    setKey(e, true);
    if (e.key === " " || e.key === "Escape") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => setKey(e, false));

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    input.aimX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.aimY = ((e.clientY - r.top) / r.height) * canvas.height;
  };

  canvas.addEventListener("mousemove", (e) => local(e));
  canvas.addEventListener("mousedown", (e) => {
    local(e);
    if (e.button === 0) {
      input.pointerDown = true;
      input.castPressed = true;
      input.uiClick = { x: input.aimX, y: input.aimY };
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.pointerDown = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      input.wheel += Math.sign(e.deltaY);
    },
    { passive: false },
  );

  const joyId = { id: -1 };
  canvas.addEventListener(
    "touchstart",
    (e) => {
      input.touch = true;
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const r = canvas.getBoundingClientRect();
        const x = ((t.clientX - r.left) / r.width) * canvas.width;
        const y = ((t.clientY - r.top) / r.height) * canvas.height;
        input.uiClick = { x, y };
        if (x < canvas.width * 0.42) {
          joyId.id = t.identifier;
          input.stick.active = true;
          input.stick.ox = x;
          input.stick.oy = y;
          input.stick.dx = 0;
          input.stick.dy = 0;
        } else {
          input.aimX = x;
          input.aimY = y;
          input.pointerDown = true;
          input.castPressed = true;
        }
      }
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const r = canvas.getBoundingClientRect();
        const x = ((t.clientX - r.left) / r.width) * canvas.width;
        const y = ((t.clientY - r.top) / r.height) * canvas.height;
        if (t.identifier === joyId.id) {
          const dx = x - input.stick.ox;
          const dy = y - input.stick.oy;
          const mag = Math.hypot(dx, dy) || 1;
          const cap = 54;
          const s = Math.min(cap, mag) / cap;
          input.stick.dx = (dx / mag) * s;
          input.stick.dy = (dy / mag) * s;
        } else {
          input.aimX = x;
          input.aimY = y;
          input.pointerDown = true;
        }
      }
    },
    { passive: false },
  );
  const endTouch = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId.id) {
        joyId.id = -1;
        input.stick.active = false;
        input.stick.dx = 0;
        input.stick.dy = 0;
      }
    }
    if (e.touches.length === 0) input.pointerDown = false;
  };
  canvas.addEventListener("touchend", endTouch);
  canvas.addEventListener("touchcancel", endTouch);

  return input;
}

export function beginFrame(input: Input): void {
  input.interact = false;
  input.pause = false;
  input.castPressed = input.castPressed;
  let x = 0;
  let y = 0;
  if (input.keys.has("w") || input.keys.has("arrowup")) y -= 1;
  if (input.keys.has("s") || input.keys.has("arrowdown")) y += 1;
  if (input.keys.has("a") || input.keys.has("arrowleft")) x -= 1;
  if (input.keys.has("d") || input.keys.has("arrowright")) x += 1;
  if (input.stick.active) {
    x += input.stick.dx;
    y += input.stick.dy;
  }
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  input.ax = x;
  input.ay = y;
  if (
    input.justPressed.has("e") ||
    input.justPressed.has("enter") ||
    input.justPressed.has("Enter")
  ) {
    input.interact = true;
  }
  if (input.justPressed.has("escape") || input.justPressed.has("Escape") || input.justPressed.has("p")) {
    input.pause = true;
  }
}

export function endFrame(input: Input): void {
  input.justPressed.clear();
  input.wheel = 0;
  input.spellSlot = -1;
  input.castPressed = false;
  input.uiClick = null;
  input.interact = false;
  input.pause = false;
}
