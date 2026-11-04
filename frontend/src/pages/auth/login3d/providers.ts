/**
 * AI provider catalogue for the login scene.
 *
 * Every entry points at a real vector asset in `public/providers/`, served from
 * the app root. Eleven come from the official simple-icons brand set; the four
 * that simple-icons no longer ships (xAI, Groq, Cohere, Together) are
 * hand-authored to the same 24x24 grid so all tiles load through one path.
 *
 * All assets are SVG with a transparent background and an explicit brand fill,
 * so they stay crisp at any tile size and never carry a white box of their own —
 * the tile supplies the white card behind them.
 */

export interface ProviderBrand {
  /** Matches the file name in public/providers/. */
  id: string;
  name: string;
}

export const PROVIDERS: ProviderBrand[] = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "googlegemini", name: "Google Gemini" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "mistralai", name: "Mistral" },
  { id: "xai", name: "xAI" },
  { id: "cohere", name: "Cohere" },
  { id: "meta", name: "Meta" },
  { id: "groq", name: "Groq" },
  { id: "huggingface", name: "Hugging Face" },
  { id: "perplexity", name: "Perplexity" },
  { id: "together", name: "Together AI" },
  { id: "moonshotai", name: "Moonshot AI" },
  { id: "qwen", name: "Qwen" },
  { id: "alibabacloud", name: "Alibaba Cloud" },
];

/** Public URL of a provider's brand asset. */
export function providerLogoUrl(provider: ProviderBrand): string {
  return `/providers/${provider.id}.svg`;
}
