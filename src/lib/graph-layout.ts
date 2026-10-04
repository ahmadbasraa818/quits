/**
 * Geometry for the settle-up graph: everyone on a circle, their names outside
 * it, and each payment's amount beside its arrow where it covers nothing.
 */

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };
export type Arrow = { from: Point; to: Point; label: string };

export const LABEL_HEIGHT = 20;

/** About how wide an amount's label is: 11px bold figures, plus its padding. */
export const labelWidth = (label: string) => label.length * 6.6 + 12;

/**
 * Where each person sits: evenly round a circle, the first at the top,
 * leaving about 55px a side and 32px top and bottom for the names.
 */
export function circleLayout(count: number, width: number, height: number, nodeRadius: number): (Point & { angle: number })[] {
  const r = Math.min((width - 110) / 2, (height - 64) / 2) - nodeRadius / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return { x: width / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle), angle };
  });
}

/** A name outside the circle, pointing away from the middle, and the box it fills. */
export function namePlacement(node: Point & { angle: number }, name: string, nodeRadius: number) {
  const cos = Math.cos(node.angle);
  const sin = Math.sin(node.angle);
  const anchor: 'start' | 'end' | 'middle' = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
  const x = node.x + cos * (nodeRadius + 8);
  const y = node.y + sin * (nodeRadius + 10) + (anchor === 'middle' ? (sin < 0 ? -2 : 12) : 4);
  // 12px semibold text: about 6.8px a letter, sitting on its baseline.
  const width = name.length * 6.8;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
  return { text: name, x, y, anchor, box: { left, top: y - 12, right: left + width, bottom: y + 3 } };
}

/** The distance from a point to a line segment. */
export function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The distance from a point to a box: 0 inside it. */
export function toBox(p: Point, box: Box): number {
  return Math.hypot(Math.max(box.left - p.x, 0, p.x - box.right), Math.max(box.top - p.y, 0, p.y - box.bottom));
}

const turn = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const crosses = (a: Point, b: Point, c: Point, d: Point) => turn(c, d, a) * turn(c, d, b) < 0 && turn(a, b, c) * turn(a, b, d) < 0;

/** How close a line segment comes to a box: 0 if it touches or crosses it. */
export function segmentToBox(a: Point, b: Point, box: Box): number {
  const corners = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  if (toBox(a, box) === 0 || toBox(b, box) === 0) return 0;
  if (corners.some((corner, i) => crosses(a, b, corner, corners[(i + 1) % 4]))) return 0;
  return Math.min(toBox(a, box), toBox(b, box), ...corners.map((corner) => toSegment(corner, a, b)));
}

const overlaps = (a: Box, b: Box, gap: number) => a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

/** The box a label fills with its middle at `centre`. */
export const labelBox = (centre: Point, label: string): Box => {
  const half = labelWidth(label) / 2;
  return { left: centre.x - half, top: centre.y - LABEL_HEIGHT / 2, right: centre.x + half, bottom: centre.y + LABEL_HEIGHT / 2 };
};

/**
 * Where each arrow's amount goes. Every spot tried is beside the arrow and
 * clear of it: on either side, at its middle or further along, just off it
 * or a step or two further out. The chosen spot is the one that runs into
 * least: the drawing's edge, the people, their names, the labels already
 * placed and the other arrows, in that order of cost. Between equals it
 * prefers the middle of the arrow, close to it, and the side away from the
 * middle of the circle, where the arrows that cross the circle don't go.
 */
export function placeLabels(arrows: Arrow[], scene: { nodes: Point[]; nodeRadius: number; names: Box[]; width: number; height: number }): Point[] {
  const placed: Box[] = [];
  return arrows.map((arrow, index) => {
    const dx = arrow.to.x - arrow.from.x;
    const dy = arrow.to.y - arrow.from.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    // How far the label's box reaches across the arrow, plus a gap.
    const clearance = (Math.abs(normal.x) * labelWidth(arrow.label)) / 2 + (Math.abs(normal.y) * LABEL_HEIGHT) / 2 + 5;
    const middle = { x: arrow.from.x + dx / 2, y: arrow.from.y + dy / 2 };
    const inward = (scene.width / 2 - middle.x) * normal.x + (scene.height / 2 - middle.y) * normal.y > 0 ? 1 : -1;
    let best: { cost: number; centre: Point; box: Box } | null = null;
    for (const out of [0, 12, 24]) {
      for (const along of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
        for (const side of [1, -1]) {
          const reach = (clearance + out) * side;
          const centre = { x: arrow.from.x + dx * along + normal.x * reach, y: arrow.from.y + dy * along + normal.y * reach };
          const box = labelBox(centre, arrow.label);
          let cost = Math.abs(along - 0.5) * 4 + out / 6 + (side === inward ? 1 : 0);
          if (box.left < 2 || box.top < 2 || box.right > scene.width - 2 || box.bottom > scene.height - 2) cost += 100;
          for (const node of scene.nodes) if (toBox(node, box) < scene.nodeRadius + 3) cost += 60;
          for (const name of scene.names) if (overlaps(name, box, 2)) cost += 40;
          for (const other of placed) if (overlaps(other, box, 3)) cost += 40;
          arrows.forEach((other, j) => {
            if (j === index) return;
            const gap = segmentToBox(other.from, other.to, box);
            if (gap < 4) cost += 12 - gap * 2;
          });
          if (!best || cost < best.cost) best = { cost, centre, box };
        }
      }
    }
    placed.push(best!.box);
    return best!.centre;
  });
}
