import deploymentScreenshot from '@assets/image_1788876857273.png';

export default function Opportunity() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">02 / opportunity</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">The opportunity</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[6vh] grid flex-1 grid-cols-[1fr_1fr] items-center gap-[6vw]">
          <div>
            <p className="max-w-[43vw] text-[2.05vw] font-bold leading-[1.2] tracking-[-0.03em] text-muted">One operational control plane for subscriber, building, and device context</p>
            <div className="hairline my-[4vh] w-full" />
            <p className="max-w-[42vw] text-[1.65vw] leading-[1.35] text-muted">Designed for an ISP environment spanning 80+ condo buildings and approximately 8,000 subscribers</p>
            <div className="mt-[4vh] flex gap-[3vw]">
              <div>
                <div className="text-[4.5vw] font-black leading-none tracking-[-0.08em]">80+</div>
                <div className="mono mt-[1vh] text-[0.85vw] uppercase tracking-[0.12em] text-slate-400">buildings</div>
              </div>
              <div className="border-l border-slate-200 pl-[3vw]">
                <div className="text-[4.5vw] font-black leading-none tracking-[-0.08em]">8,000</div>
                <div className="mono mt-[1vh] text-[0.85vw] uppercase tracking-[0.12em] text-slate-400">subscribers</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute right-[-1vw] top-[-3vh] h-[45vh] w-[38vw] border border-slate-200 bg-white/60" />
            <div className="relative mx-auto w-[35vw] rotate-[-3deg] border-[0.7vw] border-primary bg-primary p-[0.5vw] shadow-[1.2vw_1.2vw_0_rgba(10,22,40,0.12)]">
              <img src={deploymentScreenshot} crossOrigin="anonymous" alt="Current Router Control production deployment view" className="block h-[32vh] w-full object-cover object-top" />
            </div>
            <div className="mono relative mt-[3vh] text-center text-[0.85vw] uppercase tracking-[0.12em] text-slate-400">A foundation ready to become a product</div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">From tools to platform</div>
          <div className="mono text-[0.82vw] font-semibold">03</div>
        </div>
      </div>
    </div>
  );
}