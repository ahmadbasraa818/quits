import { useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Transfer } from '@/lib/balances';
import { circleLayout, LABEL_HEIGHT, labelWidth, namePlacement, placeLabels, Point } from '@/lib/graph-layout';
import { formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { font, useTheme } from '@/theme';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

const NODE = 22;
const HEIGHT = 280;
const DRAW = 520;

type EdgeProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  visible: boolean;
  /** Its place in the list, to draw the arrows one after another. */
  order: number;
  label?: string;
  /** The middle of the label, beside the arrow where it covers nothing. */
  labelAt?: Point;
  labelColors: { fill: string; text: string; line: string };
};

/** An arrow that draws itself from payer to payee when it appears, and fades when it goes. */
function Edge({ x1, y1, x2, y2, width, color, visible, order, label, labelAt, labelColors }: EdgeProps) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? (visible ? 1 : 0) : 0);
  useEffect(() => {
    if (reduceMotion) shown.set(visible ? 1 : 0);
    else if (visible) shown.set(withDelay(order * 70, withTiming(1, { duration: DRAW, easing: Easing.out(Easing.cubic) })));
    else shown.set(withTiming(0, { duration: 200 }));
  }, [visible, reduceMotion, order, shown]);

  const length = Math.hypot(x2 - x1, y2 - y1);
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - shown.get()),
    strokeOpacity: shown.get() > 0.02 ? 1 : 0,
  }));
  // The head and the label arrive as the line does.
  const headProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (shown.get() - 0.7) / 0.3)) }));

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 5 + width;
  const left = { x: x2 - head * Math.cos(angle - 0.45), y: y2 - head * Math.sin(angle - 0.45) };
  const right = { x: x2 - head * Math.cos(angle + 0.45), y: y2 - head * Math.sin(angle + 0.45) };
  const pill = label ? labelWidth(label) : 0;

  return (
    <G>
      <AnimatedLine x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={[length, length]} animatedProps={lineProps} />
      <AnimatedG animatedProps={headProps}>
        <Path d={`M ${x2} ${y2} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`} fill={color} />
        {label && labelAt ? (
          <G>
            <Rect
              x={labelAt.x - pill / 2}
              y={labelAt.y - LABEL_HEIGHT / 2}
              width={pill}
              height={LABEL_HEIGHT}
              rx={LABEL_HEIGHT / 2}
              fill={labelColors.fill}
              stroke={labelColors.line}
              strokeWidth={1}
            />
            <SvgText x={labelAt.x} y={labelAt.y + 4} textAnchor="middle" fontSize={11} fontFamily={font.bold} fill={labelColors.text}>
              {label}
            </SvgText>
          </G>
        ) : null}
      </AnimatedG>
    </G>
  );
}

/**
 * Everyone in a circle, with an arrow for each payment. Switching between the
 * pair-by-pair debts and the Quits plan redraws the arrows, so the saving is
 * something you watch happen. The plan's arrows carry their amounts.
 */
export function SettleGraph({ group, plan, direct, view }: { group: Group; plan: Transfer[]; direct: Transfer[]; view: 'plan' | 'direct' }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const layout = circleLayout(group.members.length, width, HEIGHT, NODE);
  const position = new Map(group.members.map((member, index) => [member.id, layout[index]]));
  const names = group.members.map((member, index) => namePlacement(layout[index], member.id === group.me ? 'You' : member.name, NODE));

  // Every arrow either view uses, so the ones they share stay put when switching.
  const key = (transfer: Transfer) => `${transfer.from}>${transfer.to}`;
  const planKeys = new Map(plan.map((transfer, index) => [key(transfer), index]));
  const directKeys = new Map(direct.map((transfer, index) => [key(transfer), index]));
  const edges = [...plan.map((transfer) => ({ ...transfer, inPlan: true })), ...direct.filter((transfer) => !planKeys.has(key(transfer))).map((transfer) => ({ ...transfer, inPlan: false }))];
  const shownAmounts = (view === 'plan' ? plan : direct).map((transfer) => transfer.amount);
  const largest = Math.max(1, ...shownAmounts);

  // Each arrow runs between the edges of its two circles.
  const ends = (transfer: Transfer) => {
    const from = position.get(transfer.from);
    const to = position.get(transfer.to);
    if (!from || !to) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const inset = (NODE + 6) / (Math.hypot(dx, dy) || 1);
    return { from: { x: from.x + dx * inset, y: from.y + dy * inset }, to: { x: to.x - dx * inset, y: to.y - dy * inset } };
  };
  const planArrows = plan.flatMap((transfer) => {
    const arrow = ends(transfer);
    return arrow ? [{ ...arrow, key: key(transfer), label: formatMoney(transfer.amount, group.currency) }] : [];
  });
  const spots = placeLabels(planArrows, { nodes: layout, nodeRadius: NODE, names: names.map((name) => name.box), width, height: HEIGHT });
  const labelAt = new Map(planArrows.map((arrow, index) => [arrow.key, spots[index]]));

  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height: HEIGHT }} accessible={false} testID="settle-graph">
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {edges.map((edge) => {
            const arrow = ends(edge);
            if (!arrow) return null;
            const visible = view === 'plan' ? edge.inPlan : directKeys.has(key(edge));
            const amount = view === 'plan' ? edge.amount : (direct[directKeys.get(key(edge)) ?? -1]?.amount ?? edge.amount);
            return (
              <Edge
                key={key(edge)}
                x1={arrow.from.x}
                y1={arrow.from.y}
                x2={arrow.to.x}
                y2={arrow.to.y}
                width={1.5 + (amount / largest) * 3}
                color={view === 'plan' ? theme.brand : theme.inkMuted}
                visible={visible}
                order={(view === 'plan' ? planKeys.get(key(edge)) : directKeys.get(key(edge))) ?? 0}
                label={view === 'plan' && edge.inPlan ? formatMoney(edge.amount, group.currency) : undefined}
                labelAt={labelAt.get(key(edge))}
                labelColors={{ fill: theme.card, text: theme.ink, line: theme.line }}
              />
            );
          })}
          {group.members.map((member, index) => {
            const { x, y } = layout[index];
            const name = names[index];
            return (
              <G key={member.id}>
                <Circle cx={x} cy={y} r={NODE} fill={theme.tones[member.tone % theme.tones.length]} stroke={theme.card} strokeWidth={3} />
                <SvgText x={x} y={y + 6} textAnchor="middle" fontSize={16} fontFamily={font.bold} fill={theme.ink}>
                  {member.name.charAt(0).toUpperCase()}
                </SvgText>
                <SvgText x={name.x} y={name.y} textAnchor={name.anchor} fontSize={12} fontFamily={font.semibold} fill={theme.inkMuted}>
                  {name.text}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
