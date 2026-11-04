import * as THREE from "three";

/**
 * Provider marks for the login scene.
 *
 * These are simplified vector reinterpretations drawn onto a canvas texture —
 * not official brand assets. They are decorative and sized small, but if this
 * page ever ships to the public, swap in the vendors' official SVGs and follow
 * their brand guidelines.
 */

const SIZE = 512;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Four-point "sparkle" used by Gemini and Qwen. */
function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const k = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
  ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
  ctx.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
  ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
  ctx.closePath();
  ctx.fill();
}

export interface ProviderBrand {
  id: string;
  name: string;
  /** Tile gradient. */
  from: string;
  to: string;
  /** Draws the mark in white, centred on (SIZE/2, SIZE/2). */
  mark: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
}

export const PROVIDERS: ProviderBrand[] = [
  {
    id: "openai",
    name: "OpenAI",
    from: "#12b886",
    to: "#0b7a5c",
    mark: (ctx, cx, cy, r) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineWidth = r * 0.17;
      ctx.strokeStyle = "#ffffff";
      for (let i = 0; i < 6; i += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.44, r * 0.21, r * 0.46, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    from: "#e8e0d5",
    to: "#c9bda9",
    mark: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#3d3527";
      ctx.lineWidth = r * 0.19;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.52, cy + r * 0.52);
      ctx.lineTo(cx - r * 0.04, cy - r * 0.52);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.14, cy + r * 0.52);
      ctx.lineTo(cx + r * 0.58, cy - r * 0.52);
      ctx.stroke();
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    from: "#4285f4",
    to: "#8b5cf6",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      sparkle(ctx, cx, cy, r);
    },
  },
  {
    id: "mistral",
    name: "Mistral",
    from: "#2b2b2b",
    to: "#111111",
    mark: (ctx, cx, cy, r) => {
      const w = r * 0.28;
      const h = r * 0.34;
      const cols = ["#ffd800", "#ff9d00", "#ff4f00", "#ff4f00"];
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = cols[i];
        const x = cx - r * 0.62 + i * (w + r * 0.06);
        const y = cy - r * 0.5 + (i % 2 === 0 ? 0 : r * 0.22);
        roundRect(ctx, x, y, w, h, w * 0.22);
        ctx.fill();
      }
    },
  },
  {
    id: "xai",
    name: "xAI",
    from: "#1f2937",
    to: "#0b0f19",
    mark: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = r * 0.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.5, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.16);
      ctx.stroke();
    },
  },
  {
    id: "cohere",
    name: "Cohere",
    from: "#39594d",
    to: "#1f3b32",
    mark: (ctx, cx, cy, r) => {
      const dots: Array<[number, number, number, string]> = [
        [-0.34, -0.3, 0.24, "#ff7759"],
        [0.24, -0.36, 0.18, "#d18ee2"],
        [-0.12, 0.06, 0.3, "#39594d"],
        [0.36, 0.24, 0.2, "#ff7759"],
        [-0.36, 0.3, 0.16, "#d18ee2"],
      ];
      for (const [dx, dy, rr, color] of dots) {
        ctx.beginPath();
        ctx.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = r * 0.05;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.stroke();
      }
    },
  },
  {
    id: "meta",
    name: "Llama",
    from: "#0866ff",
    to: "#0a4fc4",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      // Head
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.16, r * 0.33, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.26, cy - r * 0.38, r * 0.1, r * 0.22, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.26, cy - r * 0.38, r * 0.1, r * 0.22, 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Snout cut-out
      ctx.fillStyle = "#0866ff";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.4, r * 0.15, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    from: "#4d6bfe",
    to: "#2b45c9",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      // Body
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.05, cy + r * 0.05, r * 0.46, r * 0.3, -0.12, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.02);
      ctx.lineTo(cx - r * 0.72, cy - r * 0.34);
      ctx.lineTo(cx - r * 0.58, cy + r * 0.12);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = "#4d6bfe";
      ctx.beginPath();
      ctx.arc(cx + r * 0.28, cy - r * 0.02, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: "qwen",
    name: "Qwen",
    from: "#6d5efc",
    to: "#3b2bb5",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      sparkle(ctx, cx, cy, r * 0.92);
      ctx.fillStyle = "#3b2bb5";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: "groq",
    name: "Groq",
    from: "#f55036",
    to: "#c22d17",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(r * 1.35)}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("g", cx, cy + r * 0.06);
    },
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    from: "#ffd21e",
    to: "#f0b400",
    mark: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#2b2b2b";
      ctx.lineWidth = r * 0.11;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      // Eyes
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.arc(cx - r * 0.17, cy - r * 0.12, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.17, cy - r * 0.12, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Smile
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.06, r * 0.22, 0.25, Math.PI - 0.25);
      ctx.stroke();
      // Hands
      ctx.beginPath();
      ctx.arc(cx - r * 0.56, cy + r * 0.24, r * 0.13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.56, cy + r * 0.24, r * 0.13, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    from: "#20808d",
    to: "#12545c",
    mark: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = r * 0.13;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.12, r * (0.2 + i * 0.17), Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx, cy + r * 0.5);
      ctx.stroke();
    },
  },
  {
    id: "together",
    name: "Together",
    from: "#0f6fff",
    to: "#0a4bb5",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, cx - r * 0.56, cy - r * 0.5, r * 1.12, r * 0.19, r * 0.09);
      ctx.fill();
      roundRect(ctx, cx - r * 0.12, cy - r * 0.22, r * 0.24, r * 0.72, r * 0.1);
      ctx.fill();
    },
  },
  {
    id: "moonshot",
    name: "Moonshot",
    from: "#1b1b2f",
    to: "#0a0a16",
    mark: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#12121f";
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy - r * 0.1, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    },
  },
];

/**
 * Paints one provider tile and returns it as a texture. Callers must dispose.
 */
export function createProviderTexture(brand: ProviderBrand): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    return fallback;
  }

  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, brand.from);
  gradient.addColorStop(1, brand.to);
  roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Top-left sheen so the tile reads as a lit 3D surface.
  const sheen = ctx.createLinearGradient(0, 0, SIZE * 0.8, SIZE * 0.8);
  sheen.addColorStop(0, "rgba(255,255,255,0.28)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.04)");
  sheen.addColorStop(1, "rgba(0,0,0,0.16)");
  roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Inner hairline
  ctx.save();
  roundRect(ctx, 6, 6, SIZE - 12, SIZE - 12, SIZE * 0.2);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  brand.mark(ctx, SIZE / 2, SIZE / 2, SIZE * 0.28);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
