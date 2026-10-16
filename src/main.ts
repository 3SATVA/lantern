import { AudioBus } from "./audio";
import { createGame } from "./game";
import { createInput } from "./input";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("canvas unavailable");

const input = createInput(canvas);
const audio = new AudioBus();
const game = createGame(input, audio);

function resize(): void {
  canvas.width = Math.max(320, Math.floor(window.innerWidth));
  canvas.height = Math.max(240, Math.floor(window.innerHeight));
  game.resize(canvas.width, canvas.height);
}

window.addEventListener("resize", resize);
resize();
canvas.focus();
input.aimX = canvas.width * 0.72;
input.aimY = canvas.height * 0.5;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  game.update(dt);
  game.draw(ctx!);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
