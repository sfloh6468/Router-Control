export default function CarolAI() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">04 / support</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">Carol AI, with human control</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[7vh] grid flex-1 grid-cols-[0.8fr_1.2fr] items-center gap-[7vw]">
          <div className="relative flex h-[50vh] items-center justify-center">
            <div className="absolute h-[39vh] w-[27vw] border border-slate-200 bg-white" />
            <div className="absolute h-[30vh] w-[21vw] border border-slate-300 [transform:rotate(12deg)]" />
            <div className="relative flex h-[26vh] w-[19vw] flex-col justify-between border-2 border-primary bg-primary p-[2vw] text-white [transform:rotate(-8deg)]">
              <div className="mono text-[0.9vw] uppercase tracking-[0.16em] text-slate-300">carol / ai</div>
              <div className="text-[4.6vw] font-black leading-[0.9] tracking-[-0.08em]">01:1</div>
              <div className="text-[1.15vw] font-bold leading-[1.2]">subscriber support, with a clear human handoff</div>
            </div>
          </div>
          <div className="self-center">
            <div className="flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">01</div>
              <p className="max-w-[47vw] text-[1.65vw] leading-[1.32] text-muted">Handles text, photos, and voice notes; voice notes are transcribed and answered in writing</p>
            </div>
            <div className="my-[3.2vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">02</div>
              <p className="max-w-[47vw] text-[1.65vw] leading-[1.32] text-muted">Uses tenant-scoped subscriber history and approved runtime policies</p>
            </div>
            <div className="my-[3.2vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">03</div>
              <p className="max-w-[47vw] text-[1.65vw] leading-[1.32] text-muted">Lets authorized staff ask Carol to contact one exact subscriber for inquiry or troubleshooting</p>
            </div>
            <div className="my-[3.2vh] flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">04</div>
              <p className="max-w-[47vw] text-[1.65vw] leading-[1.32] text-muted">Escalates unresolved or human-requested cases</p>
            </div>
            <div className="flex items-start gap-[2vw]">
              <div className="mono pt-[0.5vh] text-[1.2vw] font-semibold text-slate-400">05</div>
              <p className="max-w-[47vw] text-[1.65vw] leading-[1.32] text-muted">Operates through official WhatsApp Business Platform one-to-one messaging</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">AI where it helps. People where it matters.</div>
          <div className="mono text-[0.82vw] font-semibold">05</div>
        </div>
      </div>
    </div>
  );
}