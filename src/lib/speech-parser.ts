export type ParsedSpeech =
  | {
      type: "income";
      amount: number | null;
      description: string;
      platform?: string;
    }
  | {
      type: "expense";
      amount: number | null;
      description: string;
      category?: string;
    };

const normalizeNumber = (raw: string): number | null => {
  // Remove espaços, milhar com ponto e normaliza vírgula decimal
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(\d{1,2})$/, ".$1")
    .replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Conversor de número falado em PT-BR para número
const PT_UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
};

const PT_TEENS: Record<string, number> = {
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};

const PT_TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const PT_HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

const isScale = (w: string) => w === "mil" || w === "milhao" || w === "milhão" || w === "milhoes" || w === "milhões";
const scaleValue = (w: string): number => {
  if (w === "mil") return 1_000;
  return 1_000_000; // milhão/milhões
};

const sanitizeTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const parseCardinalWords = (tokens: string[]): number | null => {
  let total = 0;
  let group = 0;
  let consumed = false;

  for (const raw of tokens) {
    const w = raw;
    if (w === "e") continue;
    if (PT_UNITS[w] !== undefined) {
      group += PT_UNITS[w];
      consumed = true;
      continue;
    }
    if (PT_TEENS[w] !== undefined) {
      group += PT_TEENS[w];
      consumed = true;
      continue;
    }
    if (PT_TENS[w] !== undefined) {
      group += PT_TENS[w];
      consumed = true;
      continue;
    }
    if (PT_HUNDREDS[w] !== undefined) {
      group += PT_HUNDREDS[w];
      consumed = true;
      continue;
    }
    if (isScale(w)) {
      const scale = scaleValue(w);
      if (group === 0) group = 1;
      total += group * scale;
      group = 0;
      consumed = true;
      continue;
    }
  }

  const result = total + group;
  if (!consumed) return null;
  return result;
};

const extractAmount = (text: string): number | null => {
  // Captura padrões: 1.200,50 | 50,90 | 50.90 | 50 | R$ 50 | 50 reais
  const re = /(?:r\$\s*)?(\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2})|\d+(?:[\.,]\d{1,2})?|\d+)/i;
  const m = text.match(re);
  if (m) {
    return normalizeNumber(m[1]);
  }

  // Sem dígitos: tenta por extenso
  const tokens = sanitizeTokens(text);
  const idxReais = tokens.findIndex((t) => t === "real" || t === "reais");
  const idxCentavos = tokens.findIndex((t) => t === "centavo" || t === "centavos");

  let integerPart: number | null = null;
  let centsPart: number | null = null;

  if (idxReais >= 0) {
    integerPart = parseCardinalWords(tokens.slice(0, idxReais));
  }
  if (idxCentavos >= 0) {
    const start = idxReais >= 0 ? idxReais + 1 : 0;
    centsPart = parseCardinalWords(tokens.slice(start, idxCentavos));
  }

  if (integerPart === null && centsPart === null) {
    // tentar parsear o texto todo
    integerPart = parseCardinalWords(tokens);
  }

  if (integerPart === null && centsPart === null) return null;
  const intNum = integerPart ?? 0;
  const decNum = centsPart ?? 0;
  return intNum + Math.min(99, decNum) / 100;
};

const includesAny = (haystack: string, needles: string[]) =>
  needles.some((n) => haystack.includes(n));

export const parseTransactionSpeech = (ptText: string): ParsedSpeech | null => {
  if (!ptText || ptText.trim().length === 0) return null;
  const text = ptText.toLowerCase();

  // Classificação
  const expenseHints = [
    "gastei",
    "paguei",
    "pagar",
    "coloquei",
    "abasteci",
    "abastecer",
    "gasolina",
    "alcool",
    "álcool",
    "etanol",
    "diesel",
    "combustivel",
    "combustível",
    "tanque",
    "encher o tanque",
    "pedagio",
    "pedágio",
    "manutencao",
    "manutenção",
    "troca de óleo",
    "oleo",
    "óleo",
    "pneu",
    "pneus",
    "calibragem",
    "lavagem",
    "lava rapido",
    "lava-rápido",
    "estacionamento",
    "seguro",
    "financiamento",
    "parcelas",
    "parcela",
    "almoço",
    "almoco",
    "janta",
    "jantar",
    "lanche",
    "comida",
    "refeição",
  ];
  const incomeHints = [
    "ganhei",
    "recebi",
    "faturei",
    "entrou",
    "corrida",
    "corridas",
    "uber",
    "99",
    "indriver",
    "in driver",
  ];

  const isExpense = includesAny(text, expenseHints);
  const isIncome = includesAny(text, incomeHints);

  // Valor
  const amount = extractAmount(text);

  // Mapeamentos
  if (isExpense && (!isIncome || includesAny(text, ["gasolina", "combust", "pedágio", "manutenção", "óleo"])) ) {
    let category: string | undefined;
    if (includesAny(text, ["gasolina", "combustivel", "combustível", "alcool", "álcool", "etanol", "diesel"])) category = "Combustível";
    else if (includesAny(text, ["pedagio", "pedágio"])) category = "Pedágio";
    else if (includesAny(text, ["almoço", "almoco", "lanche", "comida", "refeição", "janta", "jantar"])) category = "Alimentação";
    else if (includesAny(text, ["manutencao", "manutenção", "oleo", "óleo", "troca de óleo", "pneu", "pneus", "calibragem", "lavagem", "lava rapido", "lava-rápido", "oficina", "mecanico", "mecânico"])) category = "Manutenção";
    else if (includesAny(text, ["estacionamento"])) category = "Outros";
    else if (includesAny(text, ["seguro"])) category = "Outros";
    else if (includesAny(text, ["financiamento", "parcela", "parcelas"])) category = "Outros";

    return {
      type: "expense",
      amount,
      category,
      description: ptText.trim(),
    };
  }

  if (isIncome) {
    let platform: string | undefined;
    if (text.includes("uber")) platform = "Uber";
    else if (text.includes("indriver") || text.includes("in driver")) platform = "InDriver";
    else if (text.includes("99")) platform = "99";
    else if (text.includes("ifood")) platform = "iFood";

    return {
      type: "income",
      amount,
      platform,
      description: ptText.trim(),
    };
  }

  // fallback: se não identificar, retorna nulo
  return null;
};
