import * as THREE from "three";

/**
 * Provider marks for the login scene — drawn to match your real brand assets.
 * 
 * These are canvas-drawn textures so they render cleanly in 3D without external files.
 * Colors and shapes are based on your attached logo images.
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

/**
 * Anthropic Claude — 12-ray coral starburst (#DB7A55)
 */
function claudeMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#DB7A55"; // Coral orange
  
  const rayCount = 12;
  const outerR = r * 0.85;
  const innerR = r * 0.35;
  
  // Draw each ray
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (i / rayCount) * Math.PI * 2;
    const nextAngle = ((i + 1) / rayCount) * Math.PI * 2;
    
    // Outer tip of this ray
    const ox = cx + Math.cos(angle) * outerR;
    const oy = cy + Math.sin(angle) * outerR;
    
    // Inner corner points
    const ix = cx + Math.cos(angle) * innerR;
    const iy = cy + Math.sin(angle) * innerR;
    
    const nx = cx + Math.cos(nextAngle) * innerR;
    const ny = cy + Math.sin(nextAngle) * innerR;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ox, oy);
    ctx.lineTo(nx, ny);
    ctx.lineTo(ix, iy);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * OpenAI ChatGPT — 6-fold interlocking knot (black #000000 on transparent/white)
 */
function openAIMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  const segments = 6;
  const step = (Math.PI * 2) / segments;
  
  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    
    // Path follows woven pattern
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * (r * 0.6), cy + Math.sin(angle) * (r * 0.6), r * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Connect into hexagonal weave
  for (let i = 0; i < segments; i += 1) {
    const startAngle = i * step;
    const endAngle = (i + 1) * step;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(startAngle) * (r * 0.4), cy + Math.sin(startAngle) * (r * 0.4));
    ctx.lineTo(cx + Math.cos(endAngle) * (r * 0.4), cy + Math.sin(endAngle) * (r * 0.4));
    ctx.stroke();
  }
}

/**
 * DeepSeek Whale — vibrant blue whale silhouette (#4B6BFB)
 */
function deepseekMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#4B6BFB";
  
  // Whale body as curved C-shape
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.15, cy - r * 0.1, r * 0.55, r * 0.48, -0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // Pectoral fin (lower left curve)
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy + r * 0.22, r * 0.18, r * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail flukes (upper right)
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.35, cy - r * 0.35, r * 0.22, r * 0.15, 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // White negative space: eye
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx + r * 0.1, cy - r * 0.05, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  
  // White belly highlight
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.15, r * 0.35, r * 0.22, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Google Gemini — 4-pointed concave-star sparkle in brand colors (red/yellow/green/blue)
 */
function geminiMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Four points with brand colors
  const colors = ["#FF0000", "#0000FF", "#00FF00", "#FFFF00"];
  
  for (let i = 0; i < 4; i += 1) {
    const angle = (-Math.PI / 2 + i * Math.PI / 2);
    
    ctx.fillStyle = colors[i];
    
    const x0 = cx + Math.cos(angle) * r * 0.92;
    const y0 = cy + Math.sin(angle) * r * 0.92;
    const nextAngle = angle + Math.PI / 2;
    const x1 = cx + Math.cos(nextAngle) * r * 0.92;
    const y1 = cy + Math.sin(nextAngle) * r * 0.92;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(x0, y0, x1, y1);
    ctx.quadraticCurveTo((x0 + x1) / 2 - (cy - y0) * 0.3, (y0 + y1) / 2 + (cx - x0) * 0.3, cx, cy);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * XAI — black X mark (stylized diagonal cross)
 */
function xAIMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = r * 0.18;
  ctx.lineCap = "round";
  
  // Two diagonal strokes forming X
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.52, cy - r * 0.52);
  ctx.lineTo(cx + r * 0.52, cy + r * 0.52);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.52, cy - r * 0.52);
  ctx.lineTo(cx - r * 0.38, cy + r * 0.18);
  ctx.stroke();
}

/**
 * Cohere — four-dot constellation pattern in brand colors
 */
function cohereMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const dots = [
    [-0.34, -0.3, 0.24, "#FF7759"] as const,   // top-left coral
    [0.24, -0.36, 0.18, "#D18EE2"] as const,   // top-right purple
    [-0.12, 0.06, 0.3, "#39594D"] as const,     // center green
    [0.36, 0.24, 0.2, "#FF7759"] as const,      // bottom-right coral
    [-0.36, 0.3, 0.16, "#D18EE2"] as const,     // bottom-left purple
  ];
  
  for (const dot of dots) {
    const [dx, dy, rr, color] = dot;
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
  }
}

/**
 * Meta Llama — stylized llama head with ears and snout
 */
function metaLlamaMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#0866FF";
  
  // Head main body
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.16, r * 0.33, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Left ear
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.26, cy - r * 0.38, r * 0.1, r * 0.22, -0.35, 0, Math.PI * 2);
  ctx.fill();
  
  // Right ear
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.26, cy - r * 0.38, r * 0.1, r * 0.22, 0.35, 0, Math.PI * 2);
  ctx.fill();
  
  // Snout cut-out (white negative space)
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.4, r * 0.15, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Mistral — three stacked rounded rectangles in yellow/orange/red gradient
 */
function mistralMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const w = r * 0.28;
  const h = r * 0.34;
  const cols = ["#FFD800", "#FF9D00", "#FF4F00", "#FF4F00"];
  
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = cols[i];
    const x = cx - r * 0.62 + i * (w + r * 0.06);
    const y = cy - r * 0.5 + (i % 2 === 0 ? 0 : r * 0.22);
    roundRect(ctx, x, y, w, h, w * 0.22);
    ctx.fill();
  }
}

/**
 * Groq — white lowercase "g" on red-orange background
 */
function groqMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Background
  ctx.fillStyle = "#F55036";
  roundRect(ctx, cx - r * 0.56, cy - r * 0.5, r * 1.12, r * 0.85, r * 0.1);
  ctx.fill();
  
  // Letter g
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.round(r * 1.35)}px "Plus Jakarta Sans", Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("g", cx, cy + r * 0.06);
}

/**
 * Hugging Face — smiling robot face
 */
function huggingfaceMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = "#2B2B2B";
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = "round";
  
  // Round border
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  
  // Eyes
  ctx.fillStyle = "#2B2B2B";
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
}

/**
 * Perplexity — concentric arcs with vertical line
 */
function perplexityMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = "butt";
  
  // Arcs from bottom-left
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.12, r * (0.2 + i * 0.17), Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
  
  // Vertical spine
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.5);
  ctx.lineTo(cx, cy + r * 0.5);
  ctx.stroke();
}

/**
 * Together AI — T-shaped mark
 */
function togetherMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#0F6FFF";
  
  // Top bar
  roundRect(ctx, cx - r * 0.56, cy - r * 0.5, r * 1.12, r * 0.19, r * 0.09);
  ctx.fill();
  
  // Stem
  roundRect(ctx, cx - r * 0.12, cy - r * 0.22, r * 0.24, r * 0.72, r * 0.1);
  ctx.fill();
}

/**
 * Moonshot AI — crescent moon inside circle
 */
function moonshotMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#1B1B2F";
  
  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner crescent (negative space)
  ctx.fillStyle = "#12121F";
  ctx.beginPath();
  ctx.arc(cx + r * 0.2, cy - r * 0.1, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

export interface ProviderBrand {
  id: string;
  name: string;
  mark: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
}

export const PROVIDERS: ProviderBrand[] = [
  { id: "anthropic", name: "Anthropic Claude", mark: claudeMark },
  { id: "openai", name: "OpenAI ChatGPT", mark: openAIMark },
  { id: "deepseek", name: "DeepSeek Whale", mark: deepseekMark },
  { id: "google-gemini", name: "Google Gemini", mark: geminiMark },
  { id: "xai", name: "xAI", mark: xAIMark },
  { id: "cohere", name: "Cohere", mark: cohereMark },
  { id: "meta-llama", name: "Meta Llama", mark: metaLlamaMark },
  { id: "mistral", name: "Mistral", mark: mistralMark },
  { id: "groq", name: "Groq", mark: groqMark },
  { id: "huggingface", name: "Hugging Face", mark: huggingfaceMark },
  { id: "perplexity", name: "Perplexity", mark: perplexityMark },
  { id: "together", name: "Together AI", mark: togetherMark },
  { id: "moonshot", name: "Moonshot AI", mark: moonshotMark },
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

  // White background so logo appears clean
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  // Subtle border halo
  roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);
  ctx.fillStyle = "#F0F4FF";
  ctx.fill();
  
  // Inner hairline
  ctx.save();
  roundRect(ctx, 6, 6, SIZE - 12, SIZE - 12, SIZE * 0.2);
  ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  
  // Brand mark centered
  brand.mark(ctx, SIZE / 2, SIZE / 2, SIZE * 0.38);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
