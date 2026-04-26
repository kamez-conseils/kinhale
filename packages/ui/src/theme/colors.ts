// Kinhale clinical-calm color palette — values transposed from the design
// reference (`tokens.css`). All colors are OKLCH for perceptual uniformity ;
// they share chroma ≈ 0.07–0.12 so the palette stays calm.

export const kinhaleLightColors = {
  bg: 'oklch(98.5% 0.005 90)',
  surface: 'oklch(100% 0 0)',
  surface2: 'oklch(96.5% 0.006 90)',
  line: 'oklch(90% 0.008 90)',
  lineStrong: 'oklch(82% 0.01 90)',

  ink: 'oklch(22% 0.012 250)',
  ink2: 'oklch(38% 0.012 250)',
  ink3: 'oklch(55% 0.012 250)',
  ink4: 'oklch(70% 0.012 250)',

  // Maintenance (routine, fond)
  maint: 'oklch(56% 0.07 235)',
  maintSoft: 'oklch(94% 0.025 235)',
  maintInk: 'oklch(38% 0.08 235)',

  // Rescue (secours) — refined terracotta, not red
  rescue: 'oklch(58% 0.115 35)',
  rescueSoft: 'oklch(94% 0.03 35)',
  rescueInk: 'oklch(40% 0.12 35)',

  // Amber (alerts)
  amber: 'oklch(72% 0.115 75)',
  amberSoft: 'oklch(95% 0.035 75)',
  amberInk: 'oklch(48% 0.10 75)',

  // OK / done
  ok: 'oklch(60% 0.09 155)',
  okSoft: 'oklch(94% 0.03 155)',
  okInk: 'oklch(35% 0.08 155)',

  // Miss / passive
  miss: 'oklch(70% 0.005 250)',
  missSoft: 'oklch(94% 0.005 250)',

  white: 'oklch(100% 0 0)',
} as const;

export const kinhaleDarkColors = {
  bg: 'oklch(18% 0.012 250)',
  surface: 'oklch(22% 0.012 250)',
  surface2: 'oklch(25% 0.012 250)',
  line: 'oklch(30% 0.012 250)',
  lineStrong: 'oklch(38% 0.012 250)',

  ink: 'oklch(96% 0.005 90)',
  ink2: 'oklch(80% 0.008 90)',
  ink3: 'oklch(65% 0.01 90)',
  ink4: 'oklch(50% 0.012 250)',

  maint: 'oklch(72% 0.085 235)',
  maintSoft: 'oklch(32% 0.04 235)',
  maintInk: 'oklch(85% 0.08 235)',

  rescue: 'oklch(72% 0.12 35)',
  rescueSoft: 'oklch(32% 0.05 35)',
  rescueInk: 'oklch(85% 0.11 35)',

  amber: 'oklch(82% 0.12 75)',
  amberSoft: 'oklch(32% 0.05 75)',
  amberInk: 'oklch(85% 0.11 75)',

  ok: 'oklch(75% 0.10 155)',
  okSoft: 'oklch(30% 0.04 155)',
  okInk: 'oklch(85% 0.10 155)',

  miss: 'oklch(55% 0.005 250)',
  missSoft: 'oklch(28% 0.005 250)',

  white: 'oklch(100% 0 0)',
} as const;

export type KinhaleColorTokens = typeof kinhaleLightColors;
