import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface QuickYearSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  className?: string;
}

export default function QuickYearSelector({ 
  selectedYear, 
  onYearChange,
  className = "" 
}: QuickYearSelectorProps) {
  const quickYears = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100];
  const currentIndex = quickYears.indexOf(selectedYear);
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      onYearChange(quickYears[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < quickYears.length - 1) {
      onYearChange(quickYears[currentIndex + 1]);
    }
  };

  const getYearStatus = (year: number) => {
    const yearsSince2024 = year - 2024;
    if (yearsSince2024 <= 10) return { label: "Near-term", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };
    if (yearsSince2024 <= 30) return { label: "Mid-term", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
    if (yearsSince2024 <= 50) return { label: "Long-term", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" };
    return { label: "Century-end", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Quick Year Selection</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex <= 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex >= quickYears.length - 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quickYears.map((year) => {
              const isSelected = year === selectedYear;
              const status = getYearStatus(year);
              
              return (
                <Button
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onYearChange(year)}
                  className="flex flex-col h-auto p-2 space-y-1"
                >
                  <span className="font-semibold">{year}</span>
                  <span className={`text-xs px-1 py-0.5 rounded ${status.color}`}>
                    {status.label}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Selected: {selectedYear} ({selectedYear - 2024} years from now)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}