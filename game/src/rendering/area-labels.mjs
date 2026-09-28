// Preserve the sidebar's original labels while grouping each area only once.
export function buildAreaLabels(areas, regionAt, regions, minimumRegionSize) {
  const labels = new Map();
  if (!areas.length) return labels;
  const home = areas[0], groups = new Map(), entries = [];
  labels.set(home, 'Home');
  for (let i = 1; i < areas.length; i++) {
    const area = areas[i], region = regionAt(area), dx = area.cx - home.cx, dy = area.cy - home.cy;
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    let group = groups.get(region);
    if (!group) groups.set(region, group = {count: 0, directions: new Map()});
    const rank = ++group.count;
    group.directions.set(direction, (group.directions.get(direction) || 0) + 1);
    entries.push({area, region, direction, rank, index: i});
  }
  for (const {area, region, direction, rank, index} of entries) {
    const named = regions[region], group = groups.get(region);
    const base = named?.name && named.size >= minimumRegionSize ? named.name : 'Area ' + (index + 1);
    labels.set(area, group.count === 1 ? base : base + ' ' + direction + (group.directions.get(direction) > 1 ? ' ' + rank : ''));
  }
  return labels;
}
