interface TimelineStep {
  id: string;
  label: string;
  gate: boolean;
}

export function Timeline({
  stages,
  currentStep,
  doneSteps,
}: {
  stages: { name: string; steps: TimelineStep[] }[];
  currentStep: string;
  doneSteps: readonly string[];
}) {
  return (
    <aside className="sticky top-[70px] space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--panel)] p-3">
      {stages.map((stage) => (
        <div key={stage.name}>
          <div className="mb-1 text-[11px] font-bold tracking-wider text-[var(--ink3)] uppercase">
            {stage.name}
          </div>
          <div className="space-y-0.5">
            {stage.steps.map((step) => {
              const done = doneSteps.includes(step.id);
              const current = step.id === currentStep;
              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] ${
                    current ? "bg-[var(--bg)] font-semibold text-[var(--ink)]" : "text-[var(--ink2)]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center border text-[10px] ${
                      step.gate ? "rounded" : "rounded-full"
                    } ${
                      done
                        ? "border-[var(--real)] bg-[var(--real)] text-white"
                        : current
                          ? step.gate
                            ? "border-[var(--gate)] shadow-[0_0_0_3px_var(--gate-soft)]"
                            : "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]"
                          : "border-[var(--line)] bg-white"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
