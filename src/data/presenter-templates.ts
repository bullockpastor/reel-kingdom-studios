/**
 * Presenter template catalog.
 *
 * Each template defines a background / set environment for a presenter shot.
 * - `setPrompt` is appended to the Performance Director's visual prompt before
 *   the shot is sent to the video AI, giving the model authoritative background
 *   direction rather than relying solely on the agent's free-form description.
 * - The full catalog is passed to the Performance Director as `availableTemplates`
 *   so it chooses IDs from real options rather than hallucinating new ones.
 */

export interface PresenterTemplate {
  id: string;
  label: string;
  category: "church" | "studio" | "office" | "outdoor";
  description: string;   // short UI description shown on the card
  setPrompt: string;     // injected into the video generation prompt
  accentColor: string;   // tailwind bg color class for UI card accent strip
}

export const PRESENTER_TEMPLATES: PresenterTemplate[] = [
  {
    id: "dark_wood_pulpit",
    label: "Dark Wood Pulpit",
    category: "church",
    description: "Traditional sanctuary with rich mahogany paneling and warm amber uplighting.",
    setPrompt:
      "Rich dark mahogany wood paneling background, traditional Baptist church sanctuary setting, warm amber and golden uplighting, subtle burgundy and gold tones, sense of reverence and tradition, stained glass bokeh softly visible in deep background",
    accentColor: "bg-amber-900",
  },
  {
    id: "sanctuary_altar",
    label: "Sanctuary Altar",
    category: "church",
    description: "Church altar area with candlelight and sacred gold and cream tones.",
    setPrompt:
      "Church sanctuary altar area in background, soft candlelight and warm uplighting illuminating architectural details, muted gold and cream stone tones, sacred and reverent atmosphere, sense of holiness and divine presence",
    accentColor: "bg-yellow-700",
  },
  {
    id: "modern_church",
    label: "Modern Church",
    category: "church",
    description: "Contemporary sanctuary with clean lines and soft neutral lighting.",
    setPrompt:
      "Contemporary church sanctuary background with clean architectural lines, soft neutral tones with warm accent lighting, subtle modern cross motif in background, clean and aspirational atmosphere, modern worship aesthetic",
    accentColor: "bg-slate-600",
  },
  {
    id: "light_studio",
    label: "Light Studio",
    category: "studio",
    description: "Clean seamless grey studio with professional three-point lighting.",
    setPrompt:
      "Clean seamless light grey gradient studio background, professional three-point studio lighting with soft fill shadows, minimal and modern aesthetic, crisp professional broadcast environment, neutral and timeless",
    accentColor: "bg-zinc-400",
  },
  {
    id: "broadcast_studio",
    label: "Broadcast Studio",
    category: "studio",
    description: "Deep navy broadcast set with dramatic rim lighting and backlit panels.",
    setPrompt:
      "Professional broadcast television studio background, deep navy blue and charcoal with subtle backlit glass panel accents, dramatic rim lighting, authoritative news-anchor aesthetic, polished and professional",
    accentColor: "bg-blue-800",
  },
  {
    id: "dark_curtain_stage",
    label: "Stage Curtain",
    category: "studio",
    description: "Deep theatrical curtain backdrop with dramatic spotlight and cinematic shadows.",
    setPrompt:
      "Deep rich dark velvet curtain backdrop, theatrical stage setting with dramatic single spotlight from above, deep shadows at the edges vignetting the frame, cinematic and dramatic atmosphere, strong sense of gravitas and performance",
    accentColor: "bg-purple-900",
  },
  {
    id: "bookshelf_study",
    label: "Bookshelf Study",
    category: "office",
    description: "Warm library with floor-to-ceiling bookshelves and soft amber lamp light.",
    setPrompt:
      "Warm personal library study with floor-to-ceiling bookshelves lined with leather-bound books visible in soft background, warm amber lamp light, scholarly and intimate atmosphere, rich mahogany wood tones, sense of wisdom and learning",
    accentColor: "bg-amber-700",
  },
  {
    id: "home_office",
    label: "Home Office",
    category: "office",
    description: "Clean professional home setting with natural window light and warm neutrals.",
    setPrompt:
      "Clean professional home office setting, organized bookcase or tasteful decor visible in soft shallow-focus background, warm natural window light from the side, welcoming and personal atmosphere, warm neutral tones",
    accentColor: "bg-orange-700",
  },
  {
    id: "outdoor_garden",
    label: "Garden",
    category: "outdoor",
    description: "Lush green garden with soft natural daylight and foliage bokeh.",
    setPrompt:
      "Lush green garden or park setting, soft natural diffused daylight, trees and foliage in beautiful shallow bokeh background, peaceful and restorative natural atmosphere, warm green and earthy tones",
    accentColor: "bg-green-700",
  },
  {
    id: "outdoor_architecture",
    label: "Stone Architecture",
    category: "outdoor",
    description: "Classic stone or brick building exterior with dignified natural light.",
    setPrompt:
      "Classic stone or brick architectural backdrop, outdoor historic institutional building setting, clean natural diffused light, dignified and grounded aesthetic, timeless and authoritative presence, earthy stone tones",
    accentColor: "bg-stone-600",
  },
];

/** Look up a template by ID. Returns undefined if not found. */
export function getTemplate(id: string | null | undefined): PresenterTemplate | undefined {
  if (!id) return undefined;
  return PRESENTER_TEMPLATES.find((t) => t.id === id);
}

/** Minimal representation passed to the Performance Director agent. */
export const TEMPLATE_CATALOG_FOR_AGENT = PRESENTER_TEMPLATES.map(({ id, label, category, description }) => ({
  id,
  label,
  category,
  description,
}));
