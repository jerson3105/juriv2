import { createContext, useContext, useMemo, type CSSProperties } from 'react';
import type { ThemeConfig } from '../../lib/storyApi';
import { ParticleLayer } from './ParticleLayer';

// ==================== HELPERS ====================

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

// ==================== CONTEXT ====================

interface ThemeContextValue {
  themeConfig: ThemeConfig | null;
  themeSource: string | null;
  isThemed: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeConfig: null,
  themeSource: null,
  isThemed: false,
});

export const useTheme = () => useContext(ThemeContext);

// ==================== STYLE BUILDERS ====================
// These return CSSProperties for inline styles — no CSS selectors needed.

export function buildRootStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  if (!tc?.colors?.background) return undefined;
  return {
    background: tc.colors.background,
    backgroundImage: 'none',
    transition: 'background 0.5s ease',
  };
}

export function buildSidebarStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  const color = tc?.colors?.sidebar || tc?.colors?.primary;
  if (!color) return undefined;
  return {
    backgroundColor: hexToRgba(color, 0.95),
    borderColor: hexToRgba(color, 0.3),
    transition: 'background-color 0.5s ease',
  };
}

export function buildHeaderStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  const bg = tc?.colors?.background || tc?.colors?.primary;
  if (!bg) return undefined;
  return {
    backgroundColor: hexToRgba(bg, 0.85),
    borderColor: hexToRgba(isDark(bg) ? '#ffffff' : '#000000', 0.1),
    transition: 'background-color 0.5s ease',
  };
}

export function buildNavActiveStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  if (!tc?.colors?.primary) return undefined;
  const p = tc.colors.primary;
  const s = tc.colors.secondary || p;
  return {
    background: `linear-gradient(135deg, ${p}, ${s})`,
    color: '#ffffff',
    boxShadow: `0 4px 12px ${hexToRgba(p, 0.3)}`,
  };
}

export function buildSubNavActiveStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  if (!tc?.colors?.primary) return undefined;
  const sidebarBg = tc.colors.sidebar || tc.colors.primary;
  const sidebarIsDark = isDark(sidebarBg);
  const primaryIsDark = isDark(tc.colors.primary);

  // If sidebar is dark and primary is also dark, text would be invisible
  const textColor = (sidebarIsDark && primaryIsDark)
    ? (tc.colors.secondary || '#e5e7eb')
    : tc.colors.primary;

  return {
    backgroundColor: hexToRgba(tc.colors.primary, sidebarIsDark ? 0.25 : 0.15),
    color: textColor,
  };
}

export function buildHeaderBadgeStyle(tc: ThemeConfig | null): CSSProperties | undefined {
  if (!tc?.colors?.primary) return undefined;
  const s = tc.colors.secondary || tc.colors.primary;
  return {
    background: `linear-gradient(135deg, ${tc.colors.primary}, ${s})`,
  };
}

// Returns text color class info for sidebar based on darkness
export function getSidebarTextColors(tc: ThemeConfig | null): { primary: string; secondary: string; muted: string; borderColor: string } | null {
  const color = tc?.colors?.sidebar || tc?.colors?.primary;
  if (!color) return null;
  const dark = isDark(color);
  return {
    primary: dark ? '#ffffff' : '#1f2937',
    secondary: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
    muted: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
    borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };
}

export function getHeaderTextColors(tc: ThemeConfig | null): { primary: string; secondary: string } | null {
  const bg = tc?.colors?.background || tc?.colors?.primary;
  if (!bg) return null;
  const dark = isDark(bg);
  return {
    primary: dark ? '#ffffff' : '#1f2937',
    secondary: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
  };
}

// ==================== PROVIDER ====================

interface ThemeProviderProps {
  themeConfig: ThemeConfig | null;
  themeSource: string | null;
  children: React.ReactNode;
}

export const ThemeProvider = ({ themeConfig, themeSource, children }: ThemeProviderProps) => {
  const isThemed = !!themeConfig && themeSource !== 'DEFAULT';

  const value = useMemo(() => ({
    themeConfig,
    themeSource,
    isThemed,
  }), [themeConfig, themeSource, isThemed]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {isThemed && themeConfig?.particles && (
        <ParticleLayer particles={themeConfig.particles} />
      )}
    </ThemeContext.Provider>
  );
};

// ==================== THEME BANNER ====================

export const ThemeBanner = () => {
  const { themeConfig, isThemed } = useTheme();

  if (!isThemed || !themeConfig?.banner?.title) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: themeConfig.colors?.primary ? `${themeConfig.colors.primary}20` : undefined,
        color: themeConfig.colors?.primary || undefined,
      }}
    >
      {themeConfig.banner.emoji && <span>{themeConfig.banner.emoji}</span>}
      <span>{themeConfig.banner.title}</span>
    </div>
  );
};

export default ThemeProvider;
