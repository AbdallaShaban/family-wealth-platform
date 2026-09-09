import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ArabicDatePickerProps {
  date?: Date | null;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ArabicDatePicker({
  date,
  onDateChange,
  placeholder = "اختر التاريخ",
  disabled = false,
  className,
}: ArabicDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formattedDate = React.useMemo(() => {
    if (!date) return null;
    try {
      return new Intl.DateTimeFormat("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }, [date]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-right font-normal h-9 px-3 gap-2 border-input shadow-xs",
            !date && "text-muted-foreground",
            className
          )}
          dir="rtl"
        >
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span>{formattedDate || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" dir="rtl">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={(selected) => {
            onDateChange?.(selected);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default ArabicDatePicker;
