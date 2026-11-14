import { formatPercent } from "../format/format";
import { groupPositions, topNConcentration, type Group, type PortfolioSummary } from "./calc";
import { isFund } from "./taxonomy";
import type { Position } from "./types";

/**
 * Every observation is a deterministic calculation over the entered values,
 * phrased neutrally. None of them is an interpretation, rating or advice.
 */
export interface Observation {
  id: string;
  text: string;
}

export interface Insights {
  total: number;
  holdingCount: number;
  largest: Position | null;
  topN: number;
  topNWeight: number;
  sectorGroups: Group[];
  unclassifiedWeight: number;
  unclassifiedCount: number;
  fundWeight: number;
  smallCount: number;
  smallWeight: number;
  observations: Observation[];
}

/** Holdings below this share are counted as "small" for the discoverability note. */
export const SMALL_THRESHOLD = 0.01;

export function computeInsights(summary: PortfolioSummary): Insights {
  const positions = summary.drawable;
  const count = summary.positions.length;
  const largest = positions[0] ?? null;
  const topN = Math.min(3, positions.length);
  const topNWeight = topNConcentration(positions, topN);
  const sectorGroups = groupPositions(positions, "sector");
  const unclassified = sectorGroups.find((g) => g.key === "unclassified");
  const fundWeight = positions.filter((p) => isFund(p.type)).reduce((a, p) => a + p.weight, 0);
  const small = positions.filter((p) => p.weight < SMALL_THRESHOLD);
  const smallWeight = small.reduce((a, p) => a + p.weight, 0);

  const obs: Observation[] = [];
  if (largest) {
    obs.push({
      id: "largest",
      text:
        positions.length === 1
          ? `${largest.label} is the only holding with a value above zero, so it is 100% of the holdings you entered.`
          : `Your largest holding, ${largest.label}, is ${formatPercent(largest.weight)} of the holdings you entered.`,
    });
  }
  if (positions.length >= 3) {
    obs.push({
      id: "top3",
      text: `Your three largest positions account for ${formatPercent(topNWeight)} of the holdings you entered.`,
    });
  }
  const topSector = sectorGroups.find((g) => g.key.startsWith("sector:"));
  if (topSector && sectorGroups.length > 1) {
    obs.push({
      id: "top-sector",
      text: `${topSector.style.label} is the largest sector group you entered, at ${formatPercent(topSector.weight)} (${topSector.positions.length} ${plural(topSector.positions.length, "holding")}).`,
    });
  }
  if (fundWeight > 0) {
    obs.push({
      id: "funds",
      text: `Funds and ETFs make up ${formatPercent(fundWeight)}. What they hold is not broken down here, so sector figures cover only your individually entered securities.`,
    });
  }
  if (unclassified) {
    obs.push({
      id: "unclassified",
      text: `${unclassified.positions.length} ${plural(unclassified.positions.length, "holding")} (${formatPercent(unclassified.weight)}) ${unclassified.positions.length === 1 ? "has" : "have"} no sector and ${unclassified.positions.length === 1 ? "is" : "are"} shown as Unclassified.`,
    });
  }
  if (small.length > 0 && positions.length > 1) {
    obs.push({
      id: "small",
      text: `${small.length} ${plural(small.length, "holding")} ${small.length === 1 ? "is" : "are each"} under 1%; together ${formatPercent(smallWeight)}.`,
    });
  }

  return {
    total: summary.total,
    holdingCount: count,
    largest,
    topN,
    topNWeight,
    sectorGroups,
    unclassifiedWeight: unclassified?.weight ?? 0,
    unclassifiedCount: unclassified?.positions.length ?? 0,
    fundWeight,
    smallCount: small.length,
    smallWeight,
    observations: obs,
  };
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
