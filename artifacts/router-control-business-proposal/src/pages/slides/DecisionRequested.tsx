export default function DecisionRequested() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-primary text-white font-body">
      <div className="absolute right-[-8vw] top-[-20vh] h-[75vh] w-[40vw] border border-slate-700 [transform:rotate(18deg)]" />
      <div className="absolute bottom-[-24vh] left-[38vw] h-[60vh] w-[25vw] border border-slate-700 [transform:rotate(18deg)]" />
      <div className="relative flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div className="text-[1.5vw] font-black tracking-[-0.04em]">router control</div>
          <div className="mono text-right text-[0.82vw] leading-[2] text-slate-400">
            <div><span className="text-slate-600">Project:</span> Router Control</div>
            <div><span className="text-slate-600">Decision:</span> Foundation phase</div>
            <div><span className="text-slate-600">Status:</span> Proposed</div>
          </div>
        </div>
        <div className="relative z-10 mt-auto max-w-[74vw] pb-[8vh]">
          <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">09 / decision</div>
          <h2 className="text-[6.2vw] font-black leading-[0.92] tracking-[-0.075em]">Decision requested</h2>
          <div className="mt-[5vh] grid grid-cols-[1.15fr_0.85fr] gap-[5vw]">
            <div className="space-y-[1.8vh] text-[1.55vw] leading-[1.25] text-slate-300">
              <p>Approve Router Control as the strategic ISP operations platform</p>
              <p>Confirm the Starter ISP baseline and optional Operations Pro scope</p>
              <p>Nominate pilot buildings, operational owners, and approval authorities</p>
              <p>Begin a controlled foundation phase with measurable success criteria</p>
            </div>
            <div className="border-l border-slate-600 pl-[3vw]">
              <p className="text-[2.2vw] font-black leading-[1.08] tracking-[-0.04em]">A safer, clearer, more scalable way to operate ISP networks.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-700 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-500">Business proposal / September 2026</div>
          <div className="mono text-[0.82vw] font-semibold text-slate-300">10</div>
        </div>
      </div>
    </div>
  );
}