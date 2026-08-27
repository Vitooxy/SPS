import type { SankeyData } from './parse-data';

export interface PrimaryCodeMatrixCounts {
  cnt: Record<string, Record<string, number>>;
  items: Record<string, Record<string, string[]>>;
}

function splitOutliner(value: string): string[] {
  return [...new Set(value.split(/\s*(?:,|\/)\s*/).map(part => part.trim()).filter(Boolean))];
}

export function buildPrimaryCodeMatrixCounts(data: SankeyData): PrimaryCodeMatrixCounts {
  const cnt: Record<string, Record<string, number>> = {};
  const items: Record<string, Record<string, string[]>> = {};
  const otherDescriptors = new Set(data.categoryCodes?.['Other Descriptors'] ?? []);

  for (const item of data.items) {
    const scale = item.scale;
    const codes = new Set(item.derivedPrimary);
    for (const descriptor of splitOutliner(item.outliner || '')) {
      if (otherDescriptors.has(descriptor)) codes.add(descriptor);
    }

    for (const code of codes) {
      if (!cnt[code]) {
        cnt[code] = {};
        items[code] = {};
      }
      if (!cnt[code][scale]) {
        cnt[code][scale] = 0;
        items[code][scale] = [];
      }
      cnt[code][scale]++;
      items[code][scale].push(item.text);
    }
  }

  return { cnt, items };
}
