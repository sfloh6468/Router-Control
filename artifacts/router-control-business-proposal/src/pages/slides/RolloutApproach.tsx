export default function RolloutApproach() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">08 / delivery</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">Rollout approach</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="relative mt-[9vh] flex flex-1 items-center">
          <div className="absolute left-[5vw] right-[5vw] top-[13vh] h-[0.35vh] bg-slate-300" />
          <div className="relative z-10 grid w-full grid-cols-4 gap-[2vw]">
            <div className="bg-slate-50 pr-[1vw]">
              <div className="mb-[3vh] flex h-[5vw] w-[5vw] items-center justify-center bg-primary text-[2vw] font-black text-white">01</div>
              <h3 className="text-[1.85vw] font-black leading-[1.05] tracking-[-0.03em]">Foundation</h3>
              <p className="mt-[2vh] text-[1.42vw] leading-[1.3] text-muted">tenants, roles, subscriber/building data, audit, and policy controls</p>
            </div>
            <div className="bg-slate-50 pr-[1vw]">
              <div className="mb-[3vh] flex h-[5vw] w-[5vw] items-center justify-center border-2 border-primary bg-slate-50 text-[2vw] font-black">02</div>
              <h3 className="text-[1.85vw] font-black leading-[1.05] tracking-[-0.03em]">Visibility</h3>
              <p className="mt-[2vh] text-[1.42vw] leading-[1.3] text-muted">MikroTik, OLT, and DMA read-only integrations</p>
            </div>
            <div className="bg-slate-50 pr-[1vw]">
              <div className="mb-[3vh] flex h-[5vw] w-[5vw] items-center justify-center border-2 border-primary bg-slate-50 text-[2vw] font-black">03</div>
              <h3 className="text-[1.85vw] font-black leading-[1.05] tracking-[-0.03em]">Assisted operations</h3>
              <p className="mt-[2vh] text-[1.42vw] leading-[1.3] text-muted">Carol shadow mode, tickets, appointments, and guarded workflows</p>
            </div>
            <div className="bg-slate-50">
              <div className="mb-[3vh] flex h-[5vw] w-[5vw] items-center justify-center border-2 border-primary bg-slate-50 text-[2vw] font-black">04</div>
              <h3 className="text-[1.85vw] font-black leading-[1.05] tracking-[-0.03em]">Pilot and launch</h3>
              <p className="mt-[2vh] text-[1.42vw] leading-[1.3] text-muted">selected buildings, staff training, monitoring, backup, and recovery</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">Expand modules and buildings only after verification gates are met</div>
          <div className="mono text-[0.82vw] font-semibold">09</div>
        </div>
      </div>
    </div>
  );
}