with open('src/components/AdminAI.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className={`p-5 rounded-2xl border transition-all flex items-center justify-between group text-right ${',
    'className={`p-5 rounded-2xl border transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 group text-right ${'
)

content = content.replace(
    '<span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">',
    '<span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">'
)

content = content.replace(
    '<span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">',
    '<span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">'
)

with open('src/components/AdminAI.tsx', 'w') as f:
    f.write(content)
print('SUCCESS AI BUTTONS')
