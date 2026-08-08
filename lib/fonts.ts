// Fonts for the /station/[labId] detail pages. Kept separate from theme.ts
// because next/font loaders must be called at module scope — theme.ts only
// holds the *mapping* of which display font key each lab uses.
import { IBM_Plex_Sans, Orbitron, JetBrains_Mono, Space_Grotesk, Rajdhani, Chakra_Petch } from 'next/font/google';
import type { DisplayFontKey } from './phaser/theme';

export const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const orbitronFont = Orbitron({ subsets: ['latin'], weight: ['700', '800'], display: 'swap' });
const jetbrainsMonoFont = JetBrains_Mono({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' });
const spaceGroteskFont = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' });
const rajdhaniFont = Rajdhani({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' });
const chakraPetchFont = Chakra_Petch({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' });

/** className per display-font key — Revenue Bay reuses the body font (bold),
 *  so it isn't loaded twice. */
export const DISPLAY_FONT_CLASS: Record<DisplayFontKey, string> = {
  orbitron: orbitronFont.className,
  jetbrainsMono: jetbrainsMonoFont.className,
  spaceGrotesk: spaceGroteskFont.className,
  rajdhani: rajdhaniFont.className,
  chakraPetch: chakraPetchFont.className,
  ibmPlexSansBold: bodyFont.className,
};
