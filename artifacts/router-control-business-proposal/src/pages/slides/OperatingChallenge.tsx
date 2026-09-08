export default function OperatingChallenge() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="absolute left-0 top-0 h-[1.4vh] w-full bg-primary" />
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">01 / context</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">The operating challenge</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[8vh] grid flex-1 grid-cols-[1.1fr_0.9fr] gap-[7vw]">
          <div className="flex flex-col justify-center">
            <p className="max-w-[47vw] text-[2.05vw] font-bold leading-[1.22] tracking-[-0.03em] text-muted">
              Network complexity grows faster than the tools used to manage it.
            </p>
            <div className="hairline my-[4vh] w-full" />
            <div className="flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">01</div>
              <p className="max-w-[41vw] text-[1.65vw] leading-[1.35] text-muted">ISP teams manage buildings, subscribers, and network devices across disconnected tools</p>
            </div>
            <div className="my-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">02</div>
              <p className="max-w-[41vw] text-[1.65vw] leading-[1.35] text-muted">Troubleshooting is often reactive, manual, and difficult to audit</p>
            </div>
          </div>
          <div className="flex flex-col justify-center border-l border-slate-200 pl-[4vw]">
            <div className="mb-[4vh] text-[5.5vw] font-black leading-none tracking-[-0.08em] text-primary">80+</div>
            <div className="mono text-[1vw] uppercase tracking-[0.15em] text-slate-400">condo buildings in the current operating environment</div>
            <div className="my-[5vh] h-px w-[12vw] bg-primary" />
            <div className="flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">03</div>
              <p className="max-w-[26vw] text-[1.65vw] leading-[1.35] text-muted">Customer-service teams need faster answers without unsafe device access</p>
            </div>
            <div className="mt-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">04</div>
              <p className="max-w-[26vw] text-[1.65vw] leading-[1.35] text-muted">Growing operations require repeatable workflows, not more spreadsheets</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">The case for a control plane</div>
          <div className="mono text-[0.82vw] font-semibold">02</div>
        </div>
      </div>
    </div>
  );
}