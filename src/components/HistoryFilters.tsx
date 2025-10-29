import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HistoryFiltersProps {
  periodFilter: 'today' | 'week' | 'month' | 'all';
  typeFilter: 'income' | 'expense' | 'all';
  categoryFilter: string;
  categories: string[];
  onPeriodChange: (period: 'today' | 'week' | 'month' | 'all') => void;
  onTypeChange: (type: 'income' | 'expense' | 'all') => void;
  onCategoryChange: (category: string) => void;
}

const HistoryFilters = ({
  periodFilter,
  typeFilter,
  categoryFilter,
  categories,
  onPeriodChange,
  onTypeChange,
  onCategoryChange,
}: HistoryFiltersProps) => {
  const periods: Array<{ value: 'today' | 'week' | 'month' | 'all'; label: string }> = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
    { value: 'all', label: 'Todos' },
  ];

  return (
    <div className="space-y-4">
      {/* Period Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {periods.map((period) => (
          <Button
            key={period.value}
            variant={periodFilter === period.value ? "default" : "outline"}
            size="sm"
            onClick={() => onPeriodChange(period.value)}
            className="flex-shrink-0"
          >
            {period.label}
          </Button>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={typeFilter === 'income' ? "default" : "outline"}
          className="cursor-pointer px-4 py-2 bg-primary/10 text-primary border-primary hover:bg-primary/20"
          onClick={() => onTypeChange(typeFilter === 'income' ? 'all' : 'income')}
        >
          Ganhos
        </Badge>
        <Badge
          variant={typeFilter === 'expense' ? "default" : "outline"}
          className="cursor-pointer px-4 py-2 bg-destructive/10 text-destructive border-destructive hover:bg-destructive/20"
          onClick={() => onTypeChange(typeFilter === 'expense' ? 'all' : 'expense')}
        >
          Gastos
        </Badge>
        <Badge
          variant={typeFilter === 'all' ? "default" : "outline"}
          className="cursor-pointer px-4 py-2"
          onClick={() => onTypeChange('all')}
        >
          Todos
        </Badge>
      </div>

      {/* Category/Platform Filter */}
      {categories.length > 0 && (
        <div>
          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default HistoryFilters;
