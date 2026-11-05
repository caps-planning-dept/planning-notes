function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** 두 색의 대비를 돌려준다. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const MIN_WHITE_CONTRAST = 3;

/** 흰 글자를 우선하고, 흰 글자의 대비가 3:1보다 낮은 밝은 색에서만 검은 글자를 쓴다. */
export function readableTextOn(background: string): "#ffffff" | "#111111" {
  const whiteContrast = 1.05 / (luminance(background) + 0.05);
  return whiteContrast >= MIN_WHITE_CONTRAST ? "#ffffff" : "#111111";
}

export const TAB_COLOR_PRESETS = [
  "#2b2a27",
  "#e03131",
  "#d9480f",
  "#f59f00",
  "#c8f135",
  "#2f9e44",
  "#0f8a6a",
  "#1098ad",
  "#1971c2",
  "#5645d4",
  "#ae3ec9",
  "#d6336c",
];
