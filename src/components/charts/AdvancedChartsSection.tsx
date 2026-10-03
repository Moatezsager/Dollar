import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { LineChart } from "lucide-react";
import { HistoryPoint } from "../../types/rates";

interface AdvancedChartsSectionProps {
  activeTab: string;
  chartAnalysisCurrency: string;
  setChartAnalysisCurrency: (curr: string) => void;
  chartAnalysisRange: '1w' | '1m' | '6m' | '1y' | 'all';
  setChartAnalysisRange: (range: '1w' | '1m' | '6m' | '1y' | 'all') => void;
  history: HistoryPoint[];
}

export const AdvancedChartsSection: React.FC<AdvancedChartsSectionProps> = ({
  activeTab,
  chartAnalysisCurrency,
  setChartAnalysisCurrency,
  chartAnalysisRange,
  setChartAnalysisRange,
  history,
}) => {
  return (
    <section id="charts-section" className={`mt-16 ${activeTab === 'charts' ? '' : 'hidden md:block'}`}>
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gradient tracking-tight flex items-center gap-3 mb-2">
          <LineChart className="w-8 h-8 text-fuchsia-500" />
          التحليل المتقدم
        </h2>
        <p className="text-slate-400">تابع اتجاهات السوق وحركة الأسعار زمنياً</p>
      </div>
      
      <div className="glass-panel-heavy rounded-3xl premium-border p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Background Ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Currency Filter */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-slate-800/60 w-full sm:w-auto overflow-x-auto">
              {['USD_CASH', 'USD_CHECKS', 'EUR', 'GOLD_SCRAP_18'].map(curr => (
                <button
                  key={curr}
                  onClick={() => setChartAnalysisCurrency(curr)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${chartAnalysisCurrency === curr ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {curr === 'USD_CASH' ? 'دولار كاش' : curr === 'USD_CHECKS' ? 'دولار شيك' : curr === 'EUR' ? 'يورو' : curr === 'GOLD_SCRAP_18' ? 'ذهب كسر 18' : curr}
                </button>
              ))}
            </div>
            
            {/* Time Range Filter */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-slate-800/60 w-full sm:w-auto">
              {[
                { id: '1w', label: 'أسبوع' },
                { id: '1m', label: 'شهر' },
                { id: '6m', label: '6 أشهر' },
                { id: '1y', label: 'سنة' },
                { id: 'all', label: 'الكل' }
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => setChartAnalysisRange(range.id as any)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold transition-all ${chartAnalysisRange === range.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart */}
          <div className="w-full h-[300px] sm:h-[400px]">
            {history.length > 0 ? (() => {
              const now = new Date();
              let cutoff = new Date(0);
              if (chartAnalysisRange === '1w') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              if (chartAnalysisRange === '1m') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              if (chartAnalysisRange === '6m') cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
              if (chartAnalysisRange === '1y') cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
              
              const filteredData = history
                .filter(h => new Date(h.time) >= cutoff)
                .map(h => {
                  let val = 0;
                  if (chartAnalysisCurrency === 'USD_CASH') val = h.usdParallel || h.ratesParallel?.USD || 0;
                  if (chartAnalysisCurrency === 'USD_CHECKS') val = h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
                  if (chartAnalysisCurrency === 'EUR') val = h.ratesParallel?.EUR || 0;
                  if (chartAnalysisCurrency === 'GOLD_SCRAP_18') val = h.ratesParallel?.GOLD_SCRAP_18 || 0;
                  
                  return {
                    time: format(new Date(h.time), "yyyy-MM-dd HH:mm"),
                    rawTime: h.time,
                    value: val
                  };
                })
                .filter(d => d.value > 0);

              if (filteredData.length < 2) {
                return <div className="w-full h-full flex items-center justify-center text-slate-500">لا توجد بيانات كافية لهذه الفترة</div>;
              }

              const firstVal = filteredData[0].value;
              const lastVal = filteredData[filteredData.length - 1].value;
              const isUp = lastVal >= firstVal;
              const color = isUp ? "#10b981" : "#f43f5e";

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAnalysis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="time" 
                      hide={false} 
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      tickFormatter={(tick) => tick.split(' ')[0]}
                      minTickGap={30}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      hide={false}
                      orientation="right"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#050505", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)" }}
                      itemStyle={{ color: color, fontFamily: "monospace", fontSize: "16px", fontWeight: "bold" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "4px" }}
                      formatter={(val: number) => [`${val.toFixed(2)} د.ل`, chartAnalysisCurrency === 'GOLD' ? 'جرام كسر 18' : chartAnalysisCurrency]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={color} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorAnalysis)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })() : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
              </div>
            )}
          </div>
          
          {/* Statistics summary below chart */}
          {history.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
              {[
                { label: 'أعلى سعر', calc: (arr: number[]) => Math.max(...arr) },
                { label: 'أقل سعر', calc: (arr: number[]) => Math.min(...arr) },
                { label: 'متوسط السعر', calc: (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length },
                { label: 'التغير', calc: (arr: number[]) => arr[arr.length-1] - arr[0] }
              ].map((stat, i) => {
                const now = new Date();
                let cutoff = new Date(0);
                if (chartAnalysisRange === '1w') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (chartAnalysisRange === '1m') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (chartAnalysisRange === '6m') cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                if (chartAnalysisRange === '1y') cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                
                const values = history
                  .filter(h => new Date(h.time) >= cutoff)
                  .map(h => {
                    if (chartAnalysisCurrency === 'USD_CASH') return h.usdParallel || h.ratesParallel?.USD || 0;
                    if (chartAnalysisCurrency === 'USD_CHECKS') return h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
                    if (chartAnalysisCurrency === 'EUR') return h.ratesParallel?.EUR || 0;
                    if (chartAnalysisCurrency === 'GOLD_SCRAP_18') return h.ratesParallel?.GOLD_SCRAP_18 || 0;
                    return 0;
                  }).filter(v => v > 0);
                  
                const val = values.length > 0 ? stat.calc(values) : 0;
                const isChange = i === 3;
                const isPositive = val > 0;
                
                return (
                  <div key={i} className="bg-white/5 rounded-2xl p-3 border border-slate-800/60 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{stat.label}</span>
                    <span className={`font-mono font-bold ${isChange ? (isPositive ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
                      {isChange ? (isPositive ? '+' : '') : ''}{val.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
