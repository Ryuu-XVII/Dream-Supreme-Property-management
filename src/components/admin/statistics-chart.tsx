import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Activity, Percent, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DatePickerWithRange } from "@/components/admin/date-range-picker";
import { cn } from "@/lib/utils";

// Mock data for trends
const revenueData = [
  { month: "Jan", revenue: 450000, target: 400000, expenses: 280000 },
  { month: "Feb", revenue: 520000, target: 420000, expenses: 310000 },
  { month: "Mar", revenue: 480000, target: 450000, expenses: 290000 },
  { month: "Apr", revenue: 610000, target: 480000, expenses: 340000 },
  { month: "May", revenue: 590000, target: 500000, expenses: 330000 },
  { month: "Jun", revenue: 720000, target: 550000, expenses: 390000 },
  { month: "Jul", revenue: 680000, target: 580000, expenses: 360000 },
];

const occupancyData = [
  { month: "Jan", residential: 92, commercial: 85 },
  { month: "Feb", residential: 94, commercial: 86 },
  { month: "Mar", residential: 93, commercial: 88 },
  { month: "Apr", residential: 95, commercial: 87 },
  { month: "May", residential: 96, commercial: 89 },
  { month: "Jun", residential: 97, commercial: 90 },
  { month: "Jul", residential: 98, commercial: 92 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-xl">
        <p className="text-sm font-medium mb-2 pb-2 border-b border-border/50">
          {label} {new Date().getFullYear()}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-medium">
                {entry.name.includes("Occupancy") ||
                entry.name === "Residential" ||
                entry.name === "Commercial"
                  ? `${entry.value}%`
                  : `R${entry.value.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function StatisticsChart() {
  const [activeTab, setActiveTab] = useState("revenue");

  const totalRevenue = useMemo(() => revenueData.reduce((acc, curr) => acc + curr.revenue, 0), []);
  const totalTarget = useMemo(() => revenueData.reduce((acc, curr) => acc + curr.target, 0), []);
  const avgOccupancy = useMemo(() => {
    const total = occupancyData.reduce((acc, curr) => acc + curr.residential, 0);
    return Math.round(total / occupancyData.length);
  }, []);

  const revenueGrowth = ((totalRevenue - totalTarget) / totalTarget) * 100;

  return (
    <GlassCard className="col-span-1 lg:col-span-2 xl:col-span-4 p-0 overflow-hidden">
      <div className="border-b border-border p-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">Financial Overview</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue and occupancy trends for the selected period.
            </p>
          </div>
          <DatePickerWithRange />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 sm:px-6 pb-0">
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Percent className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Revenue YTD</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-display font-semibold">
              R{(totalRevenue / 1000000).toFixed(1)}M
            </span>
            <div
              className={cn(
                "flex items-center text-xs font-medium px-2 py-1 rounded-md",
                revenueGrowth >= 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-red-500/10 text-red-600",
              )}
            >
              {revenueGrowth >= 0 ? (
                <ArrowUpRight className="size-3 mr-1" />
              ) : (
                <ArrowDownRight className="size-3 mr-1" />
              )}
              {Math.abs(revenueGrowth).toFixed(1)}% vs target
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Net Profit YTD</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-display font-semibold">R1.4M</span>
            <div className="flex items-center text-xs font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <ArrowUpRight className="size-3 mr-1" />
              12.4% vs last yr
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Percent className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Avg Occupancy</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-display font-semibold">{avgOccupancy}%</span>
            <div className="flex items-center text-xs font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <ArrowUpRight className="size-3 mr-1" />
              2.1%
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <TrendingUp className="size-4" />
              Revenue Trends
            </TabsTrigger>
            <TabsTrigger value="occupancy" className="flex items-center gap-2">
              <Activity className="size-4" />
              Occupancy Rates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4">
            <div className="h-87.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
                    dx={-10}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{
                      stroke: "hsl(var(--muted-foreground))",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                  <Area
                    type="monotone"
                    dataKey="target"
                    name="Target Revenue"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#colorTarget)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Operating Expenses"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Actual Revenue"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="occupancy" className="space-y-4">
            <div className="h-87.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={occupancyData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  barGap={8}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                    dx={-10}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                  <Bar
                    dataKey="residential"
                    name="Residential Occupancy"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    activeBar={{ fill: "#6366f1", stroke: "#4f46e5", strokeWidth: 1 }}
                  />
                  <Bar
                    dataKey="commercial"
                    name="Commercial Occupancy"
                    fill="#0ea5e9"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    activeBar={{ fill: "#38bdf8", stroke: "#0ea5e9", strokeWidth: 1 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </GlassCard>
  );
}
