export default function BusinessValue() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="absolute left-[5vw] top-[24vh] h-[47vh] w-[0.5vw] bg-primary" />
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">07 / outcomes</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">Business value</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[8vh] grid flex-1 grid-cols-[0.65fr_1.35fr] gap-[7vw]">
          <div className="flex flex-col justify-center">
            <p className="text-[3vw] font-black leading-[1.02] tracking-[-0.06em]">Less friction.<br />More evidence.<br />Safer scale.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-[4vw] gap-y-[5vh] self-center">
            <div className="border-t border-slate-300 pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">01</div>
              <p className="text-[1.65vw] leading-[1.28] text-muted">Reduce time spent switching between systems and manually tracing incidents</p>
            </div>
            <div className="border-t border-slate-300 pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">02</div>
              <p className="text-[1.65vw] leading-[1.28] text-muted">Give customer-service teams useful answers without exposing dangerous controls</p>
            </div>
            <div className="border-t border-slate-300 pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">03</div>
              <p className="text-[1.65vw] leading-[1.28] text-muted">Improve first-response consistency and escalation quality</p>
            </div>
            <div className="border-t border-slate-300 pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">04</div>
              <p className="text-[1.65vw] leading-[1.28] text-muted">Create operational evidence for management, compliance, and service reviews</p>
            </div>
            <div className="col-span-2 border-t border-slate-300 pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">05</div>
              <p className="max-w-[48vw] text-[1.65vw] leading-[1.28] text-muted">Establish a scalable product foundation for multi-tenant ISP growth</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">Operational clarity becomes commercial leverage</div>
          <div className="mono text-[0.82vw] font-semibold">08</div>
        </div>
      </div>
    </div>
  );
}