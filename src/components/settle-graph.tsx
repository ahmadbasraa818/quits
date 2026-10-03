import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Marker, Path, Text as SvgText } from 'react-native-svg';

import type { Transfer } from '@/lib/balances';
import type { Group } from '@/lib/types';
import { font, useTheme } from '@/theme';

const NODE = 22;

/**
 * Everyone in a circle, with an arrow for each payment. Comparing the pair-by-
 * pair debts with the settled plan shows at a glance how much simpler it gets.
 */
export function SettleGraph({ group, transfers, emphasis }: { group: Group; transfers: Transfer[]; emphasis: 'plan' | 'direct' }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;
  // Room for the names outside the circle: about 55px a side, 32px top and bottom.
  const r = Math.min((width - 110) / 2, (height - 64) / 2) - NODE / 2;
  const position = new Map(
    group.members.map((member, index) => {
      const angle = -Math.PI / 2 + (index / group.members.length) * Math.PI * 2;
      return [member.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle, member }];
    })
  );
  const largest = Math.max(1, ...transfers.map((t) => t.amount));
  const stroke = emphasis === 'plan' ? theme.brand : theme.inkMuted;

  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height }} accessible={false}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <Marker id={`arrow-${emphasis}`} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
              <Path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
            </Marker>
          </Defs>
          {transfers.map((transfer) => {
            const from = position.get(transfer.from);
            const to = position.get(transfer.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const inset = NODE + 6;
            return (
              <Line
                key={`${transfer.from}-${transfer.to}`}
                x1={from.x + (dx / length) * inset}
                y1={from.y + (dy / length) * inset}
                x2={to.x - (dx / length) * inset}
                y2={to.y - (dy / length) * inset}
                stroke={stroke}
                strokeWidth={1.5 + (transfer.amount / largest) * 3}
                strokeLinecap="round"
                markerEnd={`url(#arrow-${emphasis})`}
              />
            );
          })}
          {[...position.values()].map(({ x, y, angle, member }) => {
            // Names sit outside the circle, pointing away from the middle, clear of the arrows.
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
            const labelX = x + cos * (NODE + 8);
            const labelY = y + sin * (NODE + 10) + (anchor === 'middle' ? (sin < 0 ? -2 : 12) : 4);
            return (
              <G key={member.id}>
                <Circle cx={x} cy={y} r={NODE} fill={theme.tones[member.tone % theme.tones.length]} stroke={theme.card} strokeWidth={3} />
                <SvgText x={x} y={y + 6} textAnchor="middle" fontSize={16} fontFamily={font.bold} fill={theme.ink}>
                  {member.name.charAt(0).toUpperCase()}
                </SvgText>
                <SvgText x={labelX} y={labelY} textAnchor={anchor} fontSize={12} fontFamily={font.semibold} fill={theme.inkMuted}>
                  {member.id === group.me ? 'You' : member.name}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

