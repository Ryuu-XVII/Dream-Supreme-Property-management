import * as React from "react";
import { addDays, format, subDays, startOfYear, startOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DatePickerWithRange({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        defaultValue="ytd"
        onValueChange={(value) => {
          const today = new Date();
          if (value === "ytd") {
            setDate({ from: startOfYear(today), to: today });
          } else if (value === "last-30") {
            setDate({ from: subDays(today, 30), to: today });
          } else if (value === "last-month") {
            const start = startOfMonth(subMonths(today, 1));
            const end = subDays(startOfMonth(today), 1);
            setDate({ from: start, to: end });
          } else if (value === "last-90") {
            setDate({ from: subDays(today, 90), to: today });
          } else if (value === "all-time") {
            setDate({ from: new Date(2020, 0, 1), to: today });
          }
        }}
      >
        <SelectTrigger className="w-[140px] h-9 bg-background/50 border-border/50">
          <SelectValue placeholder="Select Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last-30">Last 30 days</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="last-90">Last 90 days</SelectItem>
          <SelectItem value="ytd">Year-to-Date</SelectItem>
          <SelectItem value="all-time">All Time</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] h-9 justify-start text-left font-normal bg-background/50 border-border/50 hover:bg-background/80",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
