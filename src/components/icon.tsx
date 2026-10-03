import Svg, { Path } from 'react-native-svg';

import { iconPaths, IconName } from './icon-paths';

export type { IconName };

/** A Phosphor icon. Decorative: the control that holds it carries the label. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color} accessible={false} aria-hidden>
      {iconPaths[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
