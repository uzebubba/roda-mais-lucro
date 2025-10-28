export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description: string;
  category?: string;
  platform?: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  paid: boolean;
}

const TRANSACTIONS_KEY = "roda_plus_transactions";
const FIXED_EXPENSES_KEY = "roda_plus_fixed_expenses";

// Initialize with mock data if empty
const initializeMockData = () => {
  const existingTransactions = localStorage.getItem(TRANSACTIONS_KEY);
  const existingExpenses = localStorage.getItem(FIXED_EXPENSES_KEY);

  if (!existingTransactions) {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        type: "income",
        amount: 250.0,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "Uber",
      },
      {
        id: "2",
        type: "expense",
        amount: 80.0,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Gasolina",
        category: "Combustível",
      },
      {
        id: "3",
        type: "income",
        amount: 320.0,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "99",
      },
      {
        id: "4",
        type: "expense",
        amount: 25.0,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Almoço",
        category: "Alimentação",
      },
      {
        id: "5",
        type: "income",
        amount: 280.0,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "InDriver",
      },
      {
        id: "6",
        type: "expense",
        amount: 15.0,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Pedágio",
        category: "Pedágio",
      },
    ];
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(mockTransactions));
  }

  if (!existingExpenses) {
    const mockExpenses: FixedExpense[] = [
      { id: "1", name: "Financiamento do Carro", amount: 890.0, dueDay: 10, paid: true },
      { id: "2", name: "Seguro", amount: 250.0, dueDay: 15, paid: false },
      { id: "3", name: "Celular", amount: 79.9, dueDay: 5, paid: true },
    ];
    localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(mockExpenses));
  }
};

initializeMockData();

export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addTransaction = (transaction: Omit<Transaction, "id">): Transaction => {
  const transactions = getTransactions();
  const newTransaction = {
    ...transaction,
    id: Date.now().toString(),
  };
  transactions.unshift(newTransaction);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  return newTransaction;
};

export const getFixedExpenses = (): FixedExpense[] => {
  const data = localStorage.getItem(FIXED_EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
};

export const addFixedExpense = (expense: Omit<FixedExpense, "id">): FixedExpense => {
  const expenses = getFixedExpenses();
  const newExpense = {
    ...expense,
    id: Date.now().toString(),
  };
  expenses.push(newExpense);
  localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(expenses));
  return newExpense;
};

export const toggleFixedExpensePaid = (id: string): void => {
  const expenses = getFixedExpenses();
  const updated = expenses.map((exp) =>
    exp.id === id ? { ...exp, paid: !exp.paid } : exp
  );
  localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(updated));
};

export const calculateTotals = () => {
  const transactions = getTransactions();
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    income,
    expenses,
    profit: income - expenses,
  };
};

export const getWeeklyProfits = () => {
  const transactions = getTransactions();
  const days = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const dayTransactions = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= date && tDate < nextDay;
    });
    
    const income = dayTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = dayTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    days.push({
      day: dayNames[date.getDay()],
      lucro: income - expenses,
    });
  }
  
  return days;
};
