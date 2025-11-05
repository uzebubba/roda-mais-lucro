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
  const re = /(?:r\$\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?|\d+)/i;
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
    integerPart = parseNumberFromTokens(tokens.slice(0, idxReais));
  }
  if (idxCentavos >= 0) {
    const start = idxReais >= 0 ? idxReais + 1 : 0;
    centsPart = parseNumberFromTokens(tokens.slice(start, idxCentavos));
  }

  if (integerPart === null && centsPart === null) {
    // tentar parsear o texto todo
    integerPart = parseNumberFromTokens(tokens);
  }

  if (integerPart === null && centsPart === null) return null;
  const intNum = integerPart ?? 0;
  const decNum = centsPart ?? 0;
  return intNum + Math.min(99, decNum) / 100;
};

const normalizeForMatch = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const PLATFORM_PATTERNS: Array<{ platform: string; regexes: RegExp[] }> = [
  {
    platform: "Uber",
    regexes: [
      /\b(?:na|no|pela|pelo|do|da|de)?\s*uber(?:\s+(?:flash|moto|eats|bag|x|black))?\b/,
      /\buber(?:\s+(?:flash|moto|eats|bag|x|black))?\b/,
    ],
  },
  {
    platform: "99",
    regexes: [
      /\b(?:na|no|pela|pelo|do|da|de)\s+99(?:\s*pop)?\b/,
      /\b99\s*pop\b/,
    ],
  },
  {
    platform: "InDriver",
    regexes: [
      /\b(?:na|no|pela|pelo|do|da|de)?\s*(?:indriver|in\s+driver)\b/,
    ],
  },
  {
    platform: "Particular",
    regexes: [
      /\b(?:corrida|cliente)?\s*particular\b/,
      /\bparticular\b/,
    ],
  },
  {
    platform: "iFood",
    regexes: [/\bifood\b/],
  },
  {
    platform: "Loggi",
    regexes: [/\bloggi\b/],
  },
  {
    platform: "Maxim",
    regexes: [/\bmaxim\b/],
  },
];

const detectPlatform = (text: string): string | undefined => {
  const normalized = normalizeForMatch(text);
  if (!normalized) return undefined;
  for (const matcher of PLATFORM_PATTERNS) {
    if (matcher.regexes.some((regex) => regex.test(normalized))) {
      return matcher.platform;
    }
  }
  return undefined;
};

const includesAny = (haystack: string, needles: string[]) => {
  const normalizedHaystack = normalizeForMatch(haystack);
  if (!normalizedHaystack) return false;
  const haystackTokens = normalizedHaystack.split(" ").filter(Boolean);
  return needles.some((needle) => {
    const normalizedNeedle = normalizeForMatch(needle);
    if (!normalizedNeedle) {
      return false;
    }
    if (normalizedNeedle.includes(" ")) {
      return normalizedHaystack.includes(normalizedNeedle);
    }
    return haystackTokens.includes(normalizedNeedle);
  });
};

const isNumberToken = (token: string): boolean => {
  if (!token) return false;
  if (token === "e") return true;
  if (isScale(token)) return true;
  return (
    PT_UNITS[token] !== undefined ||
    PT_TEENS[token] !== undefined ||
    PT_TENS[token] !== undefined ||
    PT_HUNDREDS[token] !== undefined
  );
};

const splitNumberSequences = (tokens: string[]): string[][] => {
  const sequences: string[][] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    if (current.length > 0) {
      sequences.push(current);
      current = [];
    }
  };

  for (const token of tokens) {
    if (isNumberToken(token)) {
      current.push(token);
      continue;
    }
    pushCurrent();
  }

  pushCurrent();
  return sequences;
};

const parseNumberFromTokens = (tokens: string[]): number | null => {
  const sequences = splitNumberSequences(tokens);
  for (let index = sequences.length - 1; index >= 0; index -= 1) {
    const candidate = parseCardinalWords(sequences[index]);
    if (candidate !== null) {
      return candidate;
    }
  }
  return null;
};

const FUEL_KEYWORDS = [
  "combustivel",
  "combustível",
  "gasolina",
  "gasolina comum",
  "gasolina aditivada",
  "gasolina premium",
  "gasosa",
  "etanol",
  "alcool",
  "álcool",
  "diesel",
  "gnv",
  "gas",
  "gnv",
  "posto",
  "postinho",
  "tanque",
  "tanquinho",
  "bomba",
  "bombas",
  "litro",
  "litros",
  "abasteci",
  "abasteceu",
  "abastecer",
  "abastecendo",
  "abastecimento",
  "reabasteci",
  "reabastecer",
  "reabastecimento",
  "coloquei gasolina",
  "coloquei combustivel",
  "coloquei combustível",
  "coloquei etanol",
  "coloquei diesel",
  "coloquei gnv",
  "coloquei no tanque",
  "coloquei no posto",
  "colocar gasolina",
  "colocar combustivel",
  "colocar combustível",
  "colocando gasolina",
  "colocando combustivel",
  "encher o tanque",
  "enchi o tanque",
  "enche o tanque",
  "enchemos o tanque",
  "tanque cheio",
  "tanque vazio",
  "tanquei",
  "tanquear",
  "tanqueando",
];

const FOOD_KEYWORDS = [
  "almoço",
  "almoco",
  "almocei",
  "almocar",
  "almoçar",
  "janta",
  "jantar",
  "jantei",
  "jantando",
  "jantamos",
  "lanche",
  "lanchei",
  "lanchinho",
  "marmita",
  "marmitex",
  "comida",
  "comidinha",
  "comer",
  "comi",
  "refeicao",
  "refeição",
  "refeicoes",
  "refeições",
  "padaria",
  "padoca",
  "lanchonete",
  "restaurante",
  "restaurantes",
  "cantina",
  "boteco",
  "bar",
  "hamburguer",
  "hambúrguer",
  "hamburgueria",
  "pizza",
  "pastel",
  "coxinha",
  "sanduiche",
  "sanduíche",
  "sanduba",
  "hotdog",
  "hot dog",
  "dogao",
  "cachorro quente",
  "bk",
  "burger king",
  "burgerking",
  "mcdonalds",
  "mc donalds",
  "subway",
  "habibs",
  "bobs",
  "cafe",
  "café",
  "cafezinho",
  "cafe da manha",
  "cafe da manhã",
  "cafe da tarde",
  "snack",
  "refri",
  "refrigerante",
  "suco",
  "bebida",
];
const TOLL_KEYWORDS = [
  "pedagio",
  "pedágios",
  "pedagio",
  "pedágios",
  "pedágio",
  "pedagios",
  "pedágio da",
  "pedágio do",
  "pedágio na",
  "pedágio no",
  "praça de pedágio",
  "praça do pedágio",
  "passar no pedágio",
  "passei no pedágio",
  "paguei pedágio",
  "paguei o pedágio",
  "paguei no pedágio",
  "pago pedágio",
  "pagamos pedágio",
  "pedagio ida",
  "pedagio volta",
  "cabine do pedágio",
  "tarifa do pedágio",
  "rodovia",
  "praça de cobrança",
  "cabine",
  "cabine eletrônica",
  "sem parar",
  "semparar",
  "concessionária",
  "concessionaria",
];
const MAINTENANCE_KEYWORDS = [
  "manutencao",
  "manutenção",
  "oficina",
  "mecanico",
  "mecânico",
  "eletricista",
  "eletrica",
  "eletrica do carro",
  "alinhamento",
  "balanceamento",
  "alinhamento e balanceamento",
  "suspensao",
  "suspensão",
  "amortecedor",
  "amortecedores",
  "pastilha",
  "pastilhas",
  "pastilha de freio",
  "pastilhas de freio",
  "freio",
  "freios",
  "disco de freio",
  "discos de freio",
  "embreagem",
  "embreagens",
  "radiador",
  "arrefecimento",
  "motor",
  "óleo",
  "oleo",
  "troca de óleo",
  "troca de oleo",
  "troquei o óleo",
  "troquei o oleo",
  "trocar o óleo",
  "trocar oleo",
  "filtro de óleo",
  "filtro de oleo",
  "filtro de ar",
  "filtro de combustível",
  "filtro de combustivel",
  "filtro de cabine",
  "filtro do ar",
  "velas",
  "vela de ignição",
  "bateria",
  "baterias",
  "pneu",
  "pneus",
  "troca de pneu",
  "troquei o pneu",
  "troquei os pneus",
  "pneu furado",
  "remendo de pneu",
  "calibragem",
  "calibrar pneu",
  "balancear pneu",
  "lavagem",
  "lava rapido",
  "lava-rápido",
  "lavagem completa",
  "lavagem simples",
  "lavei o carro",
  "lavei carro",
  "polimento",
  "cristalização",
  "estetica automotiva",
  "limpeza interna",
  "higienização",
  "higienizacao",
  "higienização do ar",
  "higienizacao do ar",
  "ar-condicionado",
  "ar condicionado",
  "gas do ar",
  "revisao",
  "revisão",
  "revisão periódica",
  "revisao periodica",
  "inspecao",
  "inspeção",
  "checkup",
];

export const parseTransactionSpeech = (ptText: string): ParsedSpeech | null => {
  if (!ptText || ptText.trim().length === 0) return null;
  const text = ptText.toLowerCase();

  // Classificação
  const baseExpenseHints = [
    "gastei",
    "gasto",
    "gastando",
    "gastar",
    "paguei",
    "pago",
    "pagar",
    "pagando",
    "pague",
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
    "investi",
    "investimento",
    "comprei",
    "comprar",
    "compre",
    "custou",
    "custando",
    "custar",
    "usei",
    "usando",
    "despesa",
    "despesas",
  ];
const expenseHints = [
  ...baseExpenseHints,
  ...FUEL_KEYWORDS,
  ...FOOD_KEYWORDS,
  ...TOLL_KEYWORDS,
  ...MAINTENANCE_KEYWORDS,
];
  const incomeHints = [
    "ganhei",
    "ganho",
    "recebi",
    "recebimento",
    "receita",
    "receitas",
    "fiz",
    "faturei",
    "faturou",
    "faturamento",
    "tirei",
    "lucro",
    "lucros",
    "lucrei",
    "renderam",
    "render",
    "entrou",
    "entrada",
    "caiu na conta",
    "caiu um pix",
    "pix",
    "pix caiu",
    "transferencia",
    "transferência",
    "deposito",
    "depósito",
    "depositaram",
    "pagaram",
    "pagamento recebido",
    "corrida",
    "corridas",
    "corridinha",
    "viagem",
    "viagens",
    "frete",
    "fretes",
    "entrega",
    "entregas",
    "delivery",
    "rodei",
    "rode",
    "rodou",
    "rodamos",
    "uber",
    "uber flash",
    "uber moto",
    "uber eats",
    "ubereats",
    "uberx",
    "uber black",
    "99",
    "99pop",
    "99 pop",
    "indriver",
    "in driver",
    "maxim",
    "cabify",
    "ifood",
    "loggi",
    "particular",
    "corrida particular",
    "cliente particular",
    "corrida cliente",
  ];

  const expensePriorityHints = [
    "gastei",
    "gasto",
    "gastando",
    "gastar",
    "paguei",
    "pago",
    "pagar",
    "pague",
    "coloquei",
    "abasteci",
    "abastecer",
    "comprei",
    "comprar",
    "investi",
    "investimento",
    "pagando",
    "custou",
    "custando",
    "custar",
  ];
  const expenseCategoryTriggers = [
    ...FUEL_KEYWORDS,
    ...TOLL_KEYWORDS,
    ...MAINTENANCE_KEYWORDS,
    "estacionamento",
    "seguro",
    "financiamento",
    "parcelas",
    "parcela",
    ...FOOD_KEYWORDS,
  ];

  const isExpense = includesAny(text, expenseHints);
  let isIncome = includesAny(text, incomeHints);
  const hasExpensePriority = includesAny(text, expensePriorityHints);
  const hasExpenseCategory = includesAny(text, expenseCategoryTriggers);

  // Valor
  const amount = extractAmount(text);
  const platform = detectPlatform(text);
  if (platform) {
    isIncome = true;
  }

  // Mapeamentos
  if (isExpense && (hasExpensePriority || !isIncome || hasExpenseCategory)) {
    let category: string | undefined;
    if (includesAny(text, FUEL_KEYWORDS)) category = "Combustível";
    else if (includesAny(text, TOLL_KEYWORDS)) category = "Pedágio";
    else if (includesAny(text, FOOD_KEYWORDS)) category = "Alimentação";
    else if (includesAny(text, MAINTENANCE_KEYWORDS))
      category = "Manutenção";
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
