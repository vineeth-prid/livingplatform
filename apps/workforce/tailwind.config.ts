import type { Config } from 'tailwindcss';
import { livingPreset } from '@living/design-system/preset';

export default {
  presets: [livingPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
