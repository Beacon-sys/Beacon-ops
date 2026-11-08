// Critical path method on day numbers (days since epoch).

export type Node = { id: string; start: number; end: number };           // inclusive days
export type Dep = { pred: string; succ: string; kind: "FS" | "SS" | "FF" | "SF"; lag: number };
export type CpmResult = {
  es: Map<string, number>; ef: Map<string, number>;
  float: Map<string, number>; critical: Set<string>; cycle: boolean;
};

/** Earliest start a successor can have given one dependency. */
function earliest(d: Dep, p: { es: number; ef: number }, dur: number) {
  switch (d.kind) {
    case "FS": return p.ef + 1 + d.lag;
    case "SS": return p.es + d.lag;
    case "FF": return p.ef + d.lag - dur + 1;
    case "SF": return p.es + d.lag - dur + 1;
  }
}

export function cpm(nodes: Node[], deps: Dep[]): CpmResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = deps.filter((d) => byId.has(d.pred) && byId.has(d.succ));
  const dur = (id: string) => byId.get(id)!.end - byId.get(id)!.start + 1;

  // Topological order (Kahn).
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => indeg.set(e.succ, indeg.get(e.succ)! + 1));
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    edges.filter((e) => e.pred === id).forEach((e) => {
      indeg.set(e.succ, indeg.get(e.succ)! - 1);
      if (indeg.get(e.succ) === 0) queue.push(e.succ);
    });
  }
  const cycle = order.length !== nodes.length;
  nodes.forEach((n) => { if (!order.includes(n.id)) order.push(n.id); });

  // Forward pass: never earlier than the planned start.
  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const id of order) {
    let s = byId.get(id)!.start;
    edges.filter((e) => e.succ === id && es.has(e.pred))
      .forEach((e) => { s = Math.max(s, earliest(e, { es: es.get(e.pred)!, ef: ef.get(e.pred)! }, dur(id))); });
    es.set(id, s); ef.set(id, s + dur(id) - 1);
  }

  // Backward pass from the project finish.
  const finish = Math.max(...[...ef.values()]);
  const ls = new Map<string, number>(), lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    let f = finish;
    edges.filter((e) => e.pred === id && ls.has(e.succ)).forEach((e) => {
      const sLs = ls.get(e.succ)!, sLf = lf.get(e.succ)!;
      const limit = e.kind === "FS" ? sLs - 1 - e.lag
        : e.kind === "SS" ? sLs - e.lag + dur(id) - 1
        : e.kind === "FF" ? sLf - e.lag
        : sLf - e.lag + dur(id) - 1; // SF
      f = Math.min(f, limit);
    });
    lf.set(id, f); ls.set(id, f - dur(id) + 1);
  }
  const float = new Map(order.map((id) => [id, ls.get(id)! - es.get(id)!]));
  const critical = new Set(order.filter((id) => float.get(id)! <= 0));
  return { es, ef, float, critical, cycle };
}
