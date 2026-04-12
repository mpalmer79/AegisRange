import type { ScenarioContent } from '@/lib/scenario-content';
import type { Accent } from './accents';

interface ScenarioMeta {
  id: string;
  name: string;
}

interface ScenarioHeroCardProps {
  sc: ScenarioMeta;
  ct: ScenarioContent;
  accent: Accent;
}

export default function ScenarioHeroCard({ sc, ct, accent }: ScenarioHeroCardProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 ${accent.ring} bg-gradient-to-br ${accent.gradient} p-6 sm:p-8 mb-6 shadow-lg ${accent.glow} ar-slide-up`}
    >
      <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent dark:from-white/10 dark:via-white/5 blur-3xl ar-drift-slow" />
      <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`inline-flex items-center text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full border ${accent.chip}`}>
              {sc.id.toUpperCase()}
            </span>
            <span className="inline-flex items-center text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full border border-slate-300 dark:border-gray-700 text-slate-600 dark:text-gray-400">
              MISSION BRIEFING
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">
            <span className={`bg-gradient-to-r ${accent.title} bg-clip-text text-transparent`}>
              {sc.name}
            </span>
          </h1>
          <p className="text-sm font-mono italic text-slate-500 dark:text-gray-400 mb-4">
            &ldquo;{ct.tagline}&rdquo;
          </p>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 max-w-2xl leading-relaxed">
            {ct.backstory}
          </p>

          {/* Attacker / Target row */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">Attacker</p>
              <p className="text-sm text-slate-700 dark:text-gray-200">{ct.attacker}</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-0.5">Target</p>
              <p className="text-sm text-slate-700 dark:text-gray-200">{ct.target}</p>
            </div>
          </div>
        </div>

        {/* MITRE techniques chip stack */}
        <div className="flex flex-col gap-2 lg:w-64 shrink-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">MITRE ATT&amp;CK</p>
          <div className="flex flex-wrap gap-2">
            {ct.mitreTechniques.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-[11px]"
              >
                <span className="font-mono text-cyan-700 dark:text-cyan-300">{t.id}</span>
                <span className="text-slate-600 dark:text-gray-300">{t.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
