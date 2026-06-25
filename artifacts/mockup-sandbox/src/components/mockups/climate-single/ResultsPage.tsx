import React from "react";

// Theme constants
const colors = {
  bg: "hsl(222,47%,8%)",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  border: "hsl(217,33%,22%)",
  accent: "hsl(192,91%,46%)",
  textMuted: "hsl(215,20%,65%)",
  textMain: "#ffffff",
  red: "#ef4444",
  blue: "#3b82f6",
  orange: "#f97316",
  green: "#22c55e",
  amber: "#f59e0b",
  cyan: "hsl(192,91%,46%)"
};

const glassCardStyle: React.CSSProperties = {
  backgroundColor: colors.cardBg,
  border: `1px solid ${colors.cardBorder}`,
  backdropFilter: "blur(12px)",
  borderRadius: "12px",
};

// Data
const monthlyTemps = [3.8, 4.2, 7.5, 11.2, 14.8, 18.2, 21.5, 21.0, 17.8, 13.5, 8.2, 4.5];
const monthlyPrecip = [68, 52, 58, 45, 55, 62, 75, 85, 78, 82, 76, 76];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Helper for SVG paths
const getLinePath = (data: number[], width: number, height: number, min: number, max: number) => {
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / (max - min)) * height;
    return `${x},${y}`;
  });
  // Simple cubic bezier curve approximation
  const path = points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point}`;
    const [prevX, prevY] = a[i - 1].split(',').map(Number);
    const [currX, currY] = point.split(',').map(Number);
    const cp1x = prevX + (currX - prevX) / 3;
    const cp2x = currX - (currX - prevX) / 3;
    return `${acc} C ${cp1x},${prevY} ${cp2x},${currY} ${currX},${currY}`;
  }, "");
  return path;
};

export function ResultsPage() {
  return (
    <div style={{ backgroundColor: colors.bg, color: colors.textMain, minHeight: "100vh", fontFamily: "sans-serif" }} className="flex flex-col">
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b" style={{ backgroundColor: 'rgba(10, 13, 20, 0.8)', backdropFilter: 'blur(16px)', borderColor: colors.border }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: colors.accent, color: colors.bg }}>
              CV
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: colors.textMain }}>ClimateVision</span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: colors.border }}></div>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: colors.textMain }}>Amsterdam, Netherlands</span>
            <span style={{ color: colors.textMuted }}>·</span>
            <span style={{ color: colors.accent, textShadow: `0 0 10px ${colors.accent}` }}>2050</span>
          </div>
        </div>
        <button className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-white/10" style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, color: colors.textMain }}>
          Export PDF
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* 3. Location Banner */}
        <section className="relative overflow-hidden rounded-xl h-48 flex items-end p-6" style={glassCardStyle}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <div className="relative z-10 w-full flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold mb-2 tracking-tight">Amsterdam, NL</h1>
              <p className="flex items-center gap-3 text-sm" style={{ color: colors.textMuted }}>
                <span>52.3676° N, 4.9041° E</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: colors.textMain }}>Maritime Temperate</span>
                <span>•</span>
                <span className="flex items-center gap-1">Atmospheric Sensitivity: <span style={{ color: colors.orange }}>High</span></span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Baseline Shift</div>
              <div className="text-2xl font-bold" style={{ color: colors.red }}>RCP 4.5 Scenario</div>
            </div>
          </div>
        </section>

        {/* 2. KPI Strip */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 flex flex-col gap-1" style={glassCardStyle}>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Avg Temperature</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">14.2°C</span>
              <span className="text-sm font-medium" style={{ color: colors.red }}>+2.8°</span>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-1" style={glassCardStyle}>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Annual Precip</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">812mm</span>
              <span className="text-sm font-medium" style={{ color: colors.blue }}>+6.2%</span>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-1" style={glassCardStyle}>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Heat Stress</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">18</span>
              <span className="text-sm" style={{ color: colors.textMuted }}>days/yr</span>
            </div>
            <div className="w-full h-1 mt-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: '40%', backgroundColor: colors.orange }}></div>
            </div>
          </div>
          <div className="p-5 flex items-center justify-between" style={glassCardStyle}>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Habitability</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">71<span className="text-lg" style={{ color: colors.textMuted }}>/100</span></span>
              </div>
              <span className="text-sm font-medium" style={{ color: colors.green }}>Good</span>
            </div>
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={colors.green} strokeWidth="4" strokeDasharray="71, 100" />
              </svg>
            </div>
          </div>
        </section>

        {/* 4. Temperature Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight border-b pb-2" style={{ borderColor: colors.border }}>Temperature Projection</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Annual Mean</div>
                  <div className="text-xl font-bold mt-1">14.2°C</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Change</div>
                  <div className="text-xl font-bold mt-1" style={{ color: colors.red }}>+2.8°</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Min (Jan)</div>
                  <div className="text-xl font-bold mt-1">3.8°C</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Max (Jul)</div>
                  <div className="text-xl font-bold mt-1">21.5°C</div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 p-6" style={glassCardStyle}>
              <div className="text-sm font-medium mb-4" style={{ color: colors.textMuted }}>Monthly Average Temperature (°C)</div>
              <div className="relative w-full h-48">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Grid */}
                  {[0, 25, 50, 75, 100].map(y => (
                    <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                  ))}
                  {/* Line */}
                  <path d={getLinePath(monthlyTemps, 100, 100, 0, 25)} fill="none" stroke={colors.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Points */}
                  {monthlyTemps.map((val, i) => (
                    <circle key={i} cx={(i / 11) * 100} cy={100 - ((val - 0) / 25) * 100} r="1.5" fill={colors.bg} stroke={colors.red} strokeWidth="1" />
                  ))}
                </svg>
                {/* Labels */}
                <div className="absolute inset-0 pointer-events-none flex justify-between items-end pb-1 px-1">
                  {months.map((m, i) => (
                    <div key={i} className="text-[10px] transform translate-y-6" style={{ color: colors.textMuted }}>{m[0]}</div>
                  ))}
                </div>
                {/* Y-axis Labels */}
                <div className="absolute top-0 -left-6 bottom-0 flex flex-col justify-between text-[10px]" style={{ color: colors.textMuted }}>
                  <span>25°</span>
                  <span>12°</span>
                  <span>0°</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 p-4" style={glassCardStyle}>
              <div className="text-sm font-medium mb-3" style={{ color: colors.textMuted }}>Monthly Breakdown</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {months.map((m, i) => (
                  <div key={m} className="flex justify-between items-center border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <span style={{ color: colors.textMuted }}>{m}</span>
                    <span className="font-mono">{monthlyTemps[i].toFixed(1)}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Precipitation Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight border-b pb-2" style={{ borderColor: colors.border }}>Precipitation Pattern</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Annual Total</div>
                  <div className="text-xl font-bold mt-1">812 mm</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Change</div>
                  <div className="text-xl font-bold mt-1" style={{ color: colors.blue }}>+6.2%</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Wettest</div>
                  <div className="text-xl font-bold mt-1">Aug (85)</div>
                </div>
                <div className="p-4" style={glassCardStyle}>
                  <div className="text-xs uppercase" style={{ color: colors.textMuted }}>Driest</div>
                  <div className="text-xl font-bold mt-1">Apr (45)</div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 p-6" style={glassCardStyle}>
              <div className="text-sm font-medium mb-4" style={{ color: colors.textMuted }}>Monthly Precipitation (mm)</div>
              <div className="relative w-full h-48 flex items-end justify-between px-2">
                {/* Background Grid */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                  {[0, 1, 2, 3, 4].map(y => (
                    <div key={y} className="w-full h-px" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                  ))}
                </div>
                {/* Y-axis Labels */}
                <div className="absolute top-0 -left-6 bottom-6 flex flex-col justify-between text-[10px]" style={{ color: colors.textMuted }}>
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                {/* Bars */}
                {monthlyPrecip.map((val, i) => (
                  <div key={i} className="relative w-6 group flex justify-center pb-6">
                    <div 
                      className="absolute bottom-6 w-full rounded-t-sm transition-all duration-300" 
                      style={{ 
                        height: `${(val / 100) * 100}%`,
                        background: `linear-gradient(to top, rgba(59, 130, 246, 0.2), ${colors.blue})`
                      }}
                    ></div>
                    <div className="absolute -bottom-1 text-[10px]" style={{ color: colors.textMuted }}>{months[i][0]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1 p-4" style={glassCardStyle}>
              <div className="text-sm font-medium mb-3" style={{ color: colors.textMuted }}>Monthly Breakdown</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {months.map((m, i) => (
                  <div key={m} className="flex justify-between items-center border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <span style={{ color: colors.textMuted }}>{m}</span>
                    <span className="font-mono">{monthlyPrecip[i]}mm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 6. Risk & Extremes Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight border-b pb-2" style={{ borderColor: colors.border }}>Risk & Extremes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 flex flex-col justify-between" style={{ ...glassCardStyle, borderTop: `2px solid ${colors.red}` }}>
              <div className="text-sm font-medium" style={{ color: colors.textMuted }}>Heat Stress</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold" style={{ color: colors.red }}>18</div>
                  <div className="text-xs mt-1" style={{ color: colors.textMuted }}>days/yr &gt; 35°C</div>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded bg-red-500/10" style={{ color: colors.red }}>+12 days</div>
              </div>
            </div>
            
            <div className="p-5 flex flex-col justify-between" style={{ ...glassCardStyle, borderTop: `2px solid ${colors.amber}` }}>
              <div className="text-sm font-medium flex justify-between">
                <span style={{ color: colors.textMuted }}>Drought Risk</span>
                <span style={{ color: colors.amber }}>Elevated</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold">24%</div>
                <div className="w-full h-1.5 mt-3 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: '24%', backgroundColor: colors.amber }}></div>
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col justify-between" style={{ ...glassCardStyle, borderTop: `2px solid ${colors.blue}` }}>
              <div className="text-sm font-medium flex justify-between">
                <span style={{ color: colors.textMuted }}>Flood Risk</span>
                <span style={{ color: colors.blue }}>High</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold">68%</div>
                <div className="w-full h-1.5 mt-3 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: colors.blue }}></div>
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col justify-between" style={{ ...glassCardStyle, borderTop: `2px solid ${colors.cyan}` }}>
              <div className="text-sm font-medium" style={{ color: colors.textMuted }}>Sea Level Rise</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold" style={{ color: colors.cyan, textShadow: `0 0 15px ${colors.cyan}80` }}>32</div>
                  <div className="text-xs mt-1" style={{ color: colors.textMuted }}>centimeters</div>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: `${colors.cyan}20`, color: colors.cyan }}>Critical</div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Habitability Section */}
        <section className="p-6" style={glassCardStyle}>
          <h2 className="text-xl font-bold tracking-tight border-b pb-2 mb-6" style={{ borderColor: colors.border }}>Habitability Assessment</h2>
          
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full transform -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={colors.green} strokeWidth="3" strokeDasharray="71, 100" strokeLinecap="round" />
                </svg>
                <div className="text-center">
                  <div className="text-3xl font-bold leading-none">71</div>
                  <div className="text-xs font-medium" style={{ color: colors.textMuted }}>/100</div>
                </div>
              </div>
              <div className="mt-4 px-4 py-1 rounded-full text-sm font-bold bg-green-500/20" style={{ color: colors.green }}>
                Good
              </div>
            </div>
            
            <div className="flex-1 w-full space-y-4">
              <div className="text-sm font-medium mb-2" style={{ color: colors.textMuted }}>Score Breakdown</div>
              {[
                { label: "Temperature Comfort", val: 28.4, type: "pos" },
                { label: "Precipitation", val: 22.1, type: "pos" },
                { label: "Infrastructure", val: 30.0, type: "pos" },
                { label: "Heat Penalty", val: -5.2, type: "neg" },
                { label: "Drought", val: -2.8, type: "neg" },
                { label: "Flood", val: -1.5, type: "neg" }
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <div className="w-40 truncate" style={{ color: colors.textMuted }}>{item.label}</div>
                  <div className="flex-1 h-2 rounded-full flex items-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${Math.abs(item.val)}%`, 
                        backgroundColor: item.type === 'pos' ? 'rgba(255,255,255,0.2)' : colors.red,
                        marginLeft: item.type === 'neg' ? 'auto' : '0' 
                      }}
                    ></div>
                  </div>
                  <div className="w-12 text-right font-mono text-xs" style={{ color: item.type === 'pos' ? colors.textMain : colors.red }}>
                    {item.val > 0 ? '+' : ''}{item.val.toFixed(1)}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t mt-2 text-sm font-bold" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="w-40">Final Score</div>
                <div className="flex-1"></div>
                <div className="w-12 text-right font-mono" style={{ color: colors.green }}>71.0</div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t flex flex-wrap gap-2 text-xs font-medium" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="px-3 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textMuted }}>Severe (0-39)</div>
            <div className="px-3 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textMuted }}>Poor (40-59)</div>
            <div className="px-3 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textMuted }}>Fair (60-69)</div>
            <div className="px-3 py-1 rounded" style={{ backgroundColor: `${colors.green}20`, color: colors.green }}>Good (70-84)</div>
            <div className="px-3 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textMuted }}>Excellent (85-100)</div>
          </div>
        </section>

      </main>

      {/* 8. Slim Footer */}
      <footer className="py-6 mt-8 border-t text-center text-xs" style={{ borderColor: colors.border, color: colors.textMuted }}>
        ClimateVision · CBottle/ICON Atmospheric Physics
      </footer>
    </div>
  );
}
