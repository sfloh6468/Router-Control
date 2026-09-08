export default function SafeAutomation() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="absolute bottom-0 left-0 h-[25vh] w-full bg-[#eef3f7]" />
      <div className="relative flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">05 / trust</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">Safe automation by design</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[6vh] grid flex-1 grid-cols-[0.9fr_1.1fr] items-center gap-[6vw]">
          <div className="relative flex h-[46vh] flex-col justify-center border-r border-slate-200 pr-[5vw]">
            <div className="absolute left-[-2vw] top-[4vh] h-[34vh] w-[23vw] border border-slate-300" />
            <div className="relative">
              <div className="mono mb-[3vh] text-[0.95vw] uppercase tracking-[0.16em] text-slate-400">guarded action loop</div>
              <div className="text-[3vw] font-black leading-[1] tracking-[-0.06em]">authorize</div>
              <div className="my-[1.2vh] ml-[5vw] h-[1px] w-[9vw] bg-primary" />
              <div className="text-[3vw] font-black leading-[1] tracking-[-0.06em]">verify</div>
              <div className="my-[1.2vh] ml-[10vw] h-[1px] w-[9vw] bg-primary" />
              <div className="text-[3vw] font-black leading-[1] tracking-[-0.06em]">audit</div>
            </div>
          </div>
          <div className="self-center">
            <div className="mb-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.1vw] font-semibold text-slate-400">01</div>
              <p className="max-w-[46vw] text-[1.6vw] leading-[1.28] text-muted">Deterministic authorization, approval, limits, idempotency, and post-action verification</p>
            </div>
            <div className="mb-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.1vw] font-semibold text-slate-400">02</div>
              <p className="max-w-[46vw] text-[1.6vw] leading-[1.28] text-muted">DMA remains read-only; guarded operational actions run through approved MikroTik controls</p>
            </div>
            <div className="mb-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.1vw] font-semibold text-slate-400">03</div>
              <p className="max-w-[46vw] text-[1.6vw] leading-[1.28] text-muted">No arbitrary numbers, bulk outreach, marketing, or cross-tenant access</p>
            </div>
            <div className="mb-[3vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.1vw] font-semibold text-slate-400">04</div>
              <p className="max-w-[46vw] text-[1.6vw] leading-[1.28] text-muted">WhatsApp customer-service-window and approved-template rules enforced</p>
            </div>
            <div className="flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.1vw] font-semibold text-slate-400">05</div>
              <p className="max-w-[46vw] text-[1.6vw] leading-[1.28] text-muted">Complete audit trail with privacy-aware redaction and reversible policies</p>
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">Trust is a product feature</div>
          <div className="mono text-[0.82vw] font-semibold">06</div>
        </div>
      </div>
    </div>
  );
}