export default function RouterControlDelivers() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="absolute right-0 top-0 h-full w-[28vw] bg-primary" />
      <div className="relative flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">03 / platform</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">What Router Control delivers</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[7vh] grid flex-1 grid-cols-[1.25fr_0.75fr] gap-[6vw]">
          <div className="grid grid-cols-2 gap-x-[4vw] gap-y-[5vh] self-center">
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">01</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">Multi-tenant ISP workspace with role-based access</p>
            </div>
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">02</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">Subscriber and building data foundation</p>
            </div>
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">03</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">MikroTik and Huawei / V-SOL OLT operations</p>
            </div>
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">04</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">Read-only DMA Softlab Radius Manager visibility</p>
            </div>
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">05</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">Carol AI for one-to-one subscriber support</p>
            </div>
            <div className="border-t-2 border-primary pt-[2vh]">
              <div className="mono mb-[1.5vh] text-[1vw] font-semibold text-slate-400">06</div>
              <p className="text-[1.7vw] font-bold leading-[1.2]">Tickets, appointments, alerts, reporting, and audit history</p>
            </div>
          </div>
          <div className="relative z-10 flex flex-col justify-center pl-[3vw] text-white">
            <div className="mono mb-[3vh] text-[0.95vw] uppercase tracking-[0.16em] text-slate-300">One operational layer</div>
            <p className="text-[2.65vw] font-black leading-[1.05] tracking-[-0.05em]">Context for every decision. Guardrails for every action.</p>
            <div className="mt-[5vh] h-[1px] w-[11vw] bg-slate-400" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">A modular operating layer for ISPs</div>
          <div className="mono text-[0.82vw] font-semibold">04</div>
        </div>
      </div>
    </div>
  );
}