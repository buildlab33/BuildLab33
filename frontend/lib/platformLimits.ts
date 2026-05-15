export const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  x: 280,
  youtube: 5000,
};

export function getPlatformLimit(platform: string): number {
  return PLATFORM_LIMITS[platform] ?? 3000;
}
