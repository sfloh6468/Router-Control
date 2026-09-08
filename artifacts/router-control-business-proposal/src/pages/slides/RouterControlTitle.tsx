export default function RouterControlTitle() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_22%,rgba(219,229,238,0.72),transparent_33%),linear-gradient(120deg,#f8fafc_0%,#f5f8fb_100%)]" />
      <div className="absolute right-[-5vw] top-[14vh] h-[62vh] w-[42vw] border border-slate-200/80 bg-white/30 [transform:skewX(-18deg)]" />
      <div className="absolute right-[7vw] top-[23vh] h-[44vh] w-[19vw] border border-slate-300/70 [transform:skewX(-18deg)]" />
      <div className="relative z-10 flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div className="text-[1.5vw] font-black tracking-[-0.04em]">router control</div>
          <div className="mono text-right text-[0.82vw] leading-[2] text-muted">
            <div><span className="text-slate-400">Project:</span> Router Control</div>
            <div><span className="text-slate-400">Date:</span> September 2026</div>
            <div><span className="text-slate-400">Audience:</span> ISP leadership</div>
            <div><span className="text-slate-400">Status:</span> Business proposal</div>
          </div>
        </div>
        <div className="mt-auto pb-[7vh]">
          <div className="relative w-fit">
            <div className="absolute left-[-2vw] top-[2.3vh] h-[5vh] w-[27vw] bg-primary/10" />
            <h1 className="relative text-[7.8vw] font-black leading-[0.92] tracking-[-0.075em] text-primary">Router Control</h1>
          </div>
          <div className="mt-[5vh] flex items-end justify-between">
            <p className="max-w-[53vw] text-[1.85vw] font-bold leading-[1.22] tracking-[-0.03em] text-muted">
              A secure operations platform for modern ISPs
            </p>
            <div className="hairline w-[29vw]" />
          </div>
          <div className="mono mt-[3vh] text-[1vw] text-slate-400">
            Business proposal / September 2026 / Prepared for ISP leadership
          </div>
        </div>
      </div>
    </div>
  );
}