export interface ParsedFuelSpeech {
  pricePerLiter?: number;
  totalCost?: number;
  liters?: number;
  kmCurrent?: number;
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseDecimal = (raw: string): number | null => {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const noSpaces = trimmed.replace(/\s/g, "");

  if (noSpaces.includes(",")) {
    const normalized = noSpaces.replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const dotMatches = noSpaces.match(/\./g);
  const dotCount = dotMatches ? dotMatches.length : 0;

  if (dotCount === 0) {
    const parsed = Number.parseFloat(noSpaces);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (dotCount === 1) {
    const parsed = Number.parseFloat(noSpaces);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parts = noSpaces.split(".");
  const decimalPart = parts.pop() ?? "";
  const integerPart = parts.join("");
  const normalized = `${integerPart}.${decimalPart}`;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const containsAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const PRICE_KEYWORDS = [
  "preco",
  "preço",
  "por litro",
  "o litro",
  "valor do litro",
  "litro sai",
  "litro saiu",
  "cada litro",
];

const LITERS_KEYWORDS = ["litros", "l "];

const TOTAL_KEYWORDS = [
  "total",
  "valor",
  "paguei",
  "gastei",
  "custou",
  "abasteci",
  "abastecimento",
  "reais",
  "r$",
  "coloquei",
  "colocou",
  "colocar",
  "coloque",
  "completei",
  "complete",
  "complete o tanque",
  "tanquei",
  "tanque",
];

const KM_KEYWORDS = ["km", "quilometro", "quilometros", "quilômetro", "quilômetros"];

const PRICE_MIN_VALUE = 0.5;
const PRICE_REALISTIC_MAX = 15;
const PRICE_ABSOLUTE_MAX = 25;

const buildContextExtractor = (text: string) => {
  return (start: number, end: number) => {
    const sliceStart = Math.max(0, start - 25);
    const sliceEnd = Math.min(text.length, end + 25);
    return normalizeText(text.slice(sliceStart, sliceEnd));
  };
};

export const parseFuelSpeech = (input: string): ParsedFuelSpeech | null => {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const text = input.trim();
  const normalized = normalizeText(text);
  const contextWindow = buildContextExtractor(text);

  const numberPattern =
    /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,3})|\d+(?:[.,]\d{1,3})?)/g;

  const numbers = Array.from(text.matchAll(numberPattern))
    .map((match) => {
      if (!match.index && match.index !== 0) return null;
      const value = parseDecimal(match[0]);
      if (value === null) return null;
      return {
        value,
        start: match.index,
        end: match.index + match[0].length,
      };
    })
    .filter(Boolean) as Array<{ value: number; start: number; end: number }>;

  if (numbers.length === 0) {
    return null;
  }

  const result: ParsedFuelSpeech = {};

  type FuelField = keyof ParsedFuelSpeech;
  type Candidate = { index: number; priority: number };
  const candidates: Partial<Record<FuelField, Candidate>> = {};

  const upsertCandidate = (key: FuelField, index: number, priority: number) => {
    const current = candidates[key];
    if (!current) {
      candidates[key] = { index, priority };
      return;
    }

    if (priority > current.priority) {
      candidates[key] = { index, priority };
      return;
    }

    if (
      priority === current.priority &&
      numbers[index].start >= numbers[current.index].start
    ) {
      candidates[key] = { index, priority };
    }
  };

  numbers.forEach((entry, index) => {
    const context = contextWindow(entry.start, entry.end);

    if (containsAny(context, KM_KEYWORDS)) {
      upsertCandidate("kmCurrent", index, 3);
      return;
    }

    const hasSingularLitro =
      /\blitro\b/.test(context) && !/\blitros\b/.test(context);

    if (containsAny(context, PRICE_KEYWORDS) || hasSingularLitro) {
      upsertCandidate("pricePerLiter", index, hasSingularLitro ? 4 : 3);
      return;
    }

    if (containsAny(context, LITERS_KEYWORDS)) {
      upsertCandidate("liters", index, 3);
      return;
    }

    if (numbers[index].value >= 10 && containsAny(context, TOTAL_KEYWORDS)) {
      upsertCandidate("totalCost", index, 3);
    }
  });

  numbers.forEach((entry, index) => {
    const value = entry.value;

    if (value >= PRICE_MIN_VALUE && value < 10) {
      const priority = value >= 1 ? 2.5 : 2;
      upsertCandidate("pricePerLiter", index, priority);
    } else if (value >= PRICE_MIN_VALUE && value <= PRICE_REALISTIC_MAX) {
      upsertCandidate("pricePerLiter", index, 0.75);
    } else if (value >= PRICE_MIN_VALUE && value <= PRICE_ABSOLUTE_MAX) {
      upsertCandidate("pricePerLiter", index, 0.5);
    }

    if (value >= 10) {
      upsertCandidate("totalCost", index, 1);
    }

    if (value > 0 && value <= 200) {
      upsertCandidate("liters", index, 1);
    }
  });

  const used = new Set<number>();
  const assignedIndexes: Partial<Record<FuelField, number>> = {};

  (Object.entries(candidates) as Array<[FuelField, Candidate]>)
    .sort((a, b) => {
      if (a[1].priority !== b[1].priority) {
        return b[1].priority - a[1].priority;
      }
      return numbers[b[1].index].start - numbers[a[1].index].start;
    })
    .forEach(([key, candidate]) => {
      if (used.has(candidate.index)) {
        return;
      }
      result[key] = numbers[candidate.index].value;
      assignedIndexes[key] = candidate.index;
      used.add(candidate.index);
    });

  if (
    result.pricePerLiter !== undefined &&
    result.totalCost !== undefined &&
    result.totalCost > 0 &&
    result.pricePerLiter >= result.totalCost
  ) {
    const priceIndex = assignedIndexes.pricePerLiter;
    const totalIndex = assignedIndexes.totalCost;

    const alternative = numbers
      .map((entry, index) => {
        const context = contextWindow(entry.start, entry.end);
        const hasSingularLitro =
          /\blitro\b/.test(context) && !/\blitros\b/.test(context);
        const hasPriceKeyword = containsAny(context, PRICE_KEYWORDS) || hasSingularLitro;

        let score = 0;
        if (hasPriceKeyword) {
          score += 4;
        }
        if (entry.value >= PRICE_MIN_VALUE && entry.value < 10) {
          score += 3;
        } else if (entry.value >= PRICE_MIN_VALUE && entry.value <= PRICE_REALISTIC_MAX) {
          score += 2;
        } else if (entry.value >= PRICE_MIN_VALUE && entry.value <= PRICE_ABSOLUTE_MAX) {
          score += 1;
        }

        return { value: entry.value, index, score };
      })
      .filter(({ index, value, score }) => {
        if (index === priceIndex || index === totalIndex) {
          return false;
        }
        if (value >= result.totalCost) {
          return false;
        }
        if (value < PRICE_MIN_VALUE) {
          return false;
        }
        return score > 0;
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return numbers[b.index].start - numbers[a.index].start;
      })[0];

    if (alternative) {
      result.pricePerLiter = alternative.value;
      assignedIndexes.pricePerLiter = alternative.index;
    } else {
      delete result.pricePerLiter;
    }
  }

  if (result.kmCurrent === undefined) {
    const kmAfterKeyword = normalized.match(
      /(km|quilometro|quilometros|quilômetro|quilômetros)\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/,
    );
    if (kmAfterKeyword && kmAfterKeyword[2]) {
      const value = parseDecimal(kmAfterKeyword[2]);
      if (value !== null) {
        result.kmCurrent = value;
      }
    }
  }

  const hasAny =
    result.pricePerLiter !== undefined ||
    result.totalCost !== undefined ||
    result.liters !== undefined ||
    result.kmCurrent !== undefined;

  return hasAny ? result : null;
};
