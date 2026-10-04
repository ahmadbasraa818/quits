import * as fc from 'fast-check';

import { demoGroups } from '@/store/demo';
import { summarise } from '@/store/summary';

import { Arrow, Box, circleLayout, labelBox, namePlacement, placeLabels, segmentToBox, toBox } from '../graph-layout';
import { formatMoney } from '../money';

const NODE = 22;
const HEIGHT = 280;
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The graph as the app draws it: people on the circle, arrows between their edges. */
function scene(count: number, transfers: { from: number; to: number; label: string }[], width: number) {
  const nodes = circleLayout(count, width, HEIGHT, NODE);
  const names = nodes.map((node, index) => namePlacement(node, `Person ${index}`, NODE).box);
  const arrows: Arrow[] = transfers.map(({ from, to, label }) => {
    const a = nodes[from];
    const b = nodes[to];
    const inset = (NODE + 6) / Math.hypot(b.x - a.x, b.y - a.y);
    return { from: { x: a.x + (b.x - a.x) * inset, y: a.y + (b.y - a.y) * inset }, to: { x: b.x - (b.x - a.x) * inset, y: b.y - (b.y - a.y) * inset }, label };
  });
  const spots = placeLabels(arrows, { nodes, nodeRadius: NODE, names, width, height: HEIGHT });
  return { nodes, names, arrows, boxes: spots.map((spot, index) => labelBox(spot, arrows[index].label)) };
}

describe('the circle', () => {
  it('starts at the top and spaces everyone evenly, with room for names', () => {
    const nodes = circleLayout(4, 350, HEIGHT, NODE);
    expect(nodes[0].x).toBeCloseTo(175);
    expect(nodes[0].y).toBeCloseTo(HEIGHT - nodes[2].y);
    expect(nodes[1].y).toBeCloseTo(HEIGHT / 2);
    for (const node of nodes) {
      expect(node.x - NODE).toBeGreaterThanOrEqual(55 - NODE);
      expect(node.y - NODE).toBeGreaterThanOrEqual(32 - NODE);
    }
  });

  it('sets names outside the circle, away from the middle', () => {
    const [top, right, , left] = circleLayout(4, 350, HEIGHT, NODE);
    expect(namePlacement(top, 'You', NODE)).toMatchObject({ anchor: 'middle', text: 'You' });
    expect(namePlacement(top, 'You', NODE).y).toBeLessThan(top.y - NODE);
    expect(namePlacement(right, 'Aiko', NODE).anchor).toBe('start');
    expect(namePlacement(left, 'Dev', NODE).box.right).toBeLessThan(left.x - NODE);
  });
});

describe('distances', () => {
  const box = { left: 0, top: 0, right: 10, bottom: 10 };
  it('measures from a point to a box', () => {
    expect(toBox({ x: 5, y: 5 }, box)).toBe(0);
    expect(toBox({ x: 13, y: 14 }, box)).toBe(5);
  });
  it('measures from a segment to a box, and knows when it crosses', () => {
    expect(segmentToBox({ x: -5, y: 5 }, { x: 15, y: 5 }, box)).toBe(0);
    expect(segmentToBox({ x: -5, y: 13 }, { x: 15, y: 13 }, box)).toBe(3);
    expect(segmentToBox({ x: 20, y: -20 }, { x: 20, y: 30 }, box)).toBe(10);
    expect(segmentToBox({ x: -10, y: 30 }, { x: 30, y: -10 }, box)).toBe(0);
  });
});

describe('where the amounts go', () => {
  // The demo groups' plans, at a small phone, a large phone and a wide window.
  const cases = demoGroups(new Date(2026, 9, 4)).flatMap((group) =>
    [280, 350, 600].map((width) => {
      const ids = group.members.map((member) => member.id);
      const transfers = summarise(group).settlement.transfers.map((transfer) => ({
        from: ids.indexOf(transfer.from),
        to: ids.indexOf(transfer.to),
        label: formatMoney(transfer.amount, group.currency),
      }));
      return [`${group.name} at ${width}px`, group.members.length, transfers, width] as const;
    })
  );

  it.each(cases)('cover nothing in %s', (_, count, transfers, width) => {
    const { nodes, names, arrows, boxes } = scene(count, transfers, width);
    boxes.forEach((box, index) => {
      // Inside the drawing, clear of its own arrow, every person, every name and every other arrow.
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(HEIGHT);
      expect(segmentToBox(arrows[index].from, arrows[index].to, box)).toBeGreaterThanOrEqual(4);
      for (const node of nodes) expect(toBox(node, box)).toBeGreaterThanOrEqual(NODE);
      for (const name of names) expect(overlap(name, box)).toBe(false);
      arrows.forEach((arrow, other) => {
        if (other !== index) expect(segmentToBox(arrow.from, arrow.to, box)).toBeGreaterThan(0);
      });
      boxes.forEach((other, j) => {
        if (j !== index) expect(overlap(other, box)).toBe(false);
      });
    });
  });

  it('never sits on its own arrow, in any plan', () => {
    const plan = fc
      .integer({ min: 2, max: 8 })
      .chain((count) =>
        fc.tuple(
          fc.constant(count),
          fc.array(
            fc
              .tuple(fc.nat(count - 1), fc.nat(count - 1), fc.integer({ min: 1, max: 9_999_999 }))
              .filter(([from, to]) => from !== to)
              .map(([from, to, amount]) => ({ from, to, label: formatMoney(amount, 'JPY') })),
            { minLength: 1, maxLength: count - 1 }
          ),
          fc.integer({ min: 280, max: 800 })
        )
      );
    fc.assert(
      fc.property(plan, ([count, transfers, width]) => {
        const { arrows, boxes } = scene(count, transfers, width);
        boxes.forEach((box, index) => expect(segmentToBox(arrows[index].from, arrows[index].to, box)).toBeGreaterThanOrEqual(4));
      })
    );
  });
});

