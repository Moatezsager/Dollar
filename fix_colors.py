with open('src/Admin.tsx', 'r') as f:
    content = f.read()

import re

# Fix dynamic classes which tailwind purges
content = re.sub(
    r'\{ label: "زوار الآن", value: stats\?\.onlineUsers \|\| 0, icon: Users, color: "emerald" \}',
    r'{ label: "زوار الآن", value: stats?.onlineUsers || 0, icon: Users, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", indicator: "bg-emerald-500" }',
    content
)
content = re.sub(
    r'\{ label: "المصادر", value: stats\?\.channelsCount \|\| 0, icon: Globe, color: "blue" \}',
    r'{ label: "المصادر", value: stats?.channelsCount || 0, icon: Globe, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", indicator: "bg-blue-500" }',
    content
)
content = re.sub(
    r'\{ label: "الأصول", value: stats\?\.termsCount \|\| 0, icon: Layers, color: "purple" \}',
    r'{ label: "الأصول", value: stats?.termsCount || 0, icon: Layers, bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", indicator: "bg-purple-500" }',
    content
)
content = re.sub(
    r'\{ label: "الذاكرة", value: stats\?\.memoryUsage \? \(stats\.memoryUsage\.heapUsed / 1024 / 1024\)\.toFixed\(0\) \+ "MB" : "---", icon: Zap, color: "amber" \}',
    r'{ label: "الذاكرة", value: stats?.memoryUsage ? (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(0) + "MB" : "---", icon: Zap, bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", indicator: "bg-amber-500" }',
    content
)
content = content.replace(
    '`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-400 border border-${stat.color}-500/20 shadow-lg`',
    '`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.text} border ${stat.border} shadow-lg`'
)
content = content.replace(
    '`w-1.5 h-1.5 rounded-full bg-${stat.color}-500 animate-pulse`',
    '`w-1.5 h-1.5 rounded-full ${stat.indicator} animate-pulse`'
)

with open('src/Admin.tsx', 'w') as f:
    f.write(content)
print('SUCCESS COLORS')
