export default function CommercialModel() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-primary font-body">
      <div className="flex h-full flex-col px-[5vw] py-[5vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono mb-[2vh] text-[0.9vw] font-semibold uppercase tracking-[0.18em] text-slate-400">06 / business model</div>
            <h2 className="text-[4.1vw] font-black leading-[0.95] tracking-[-0.06em]">Modular commercial model</h2>
          </div>
          <div className="mono pt-[1vh] text-[0.9vw] text-slate-400">router control</div>
        </div>
        <div className="mt-[7vh] grid flex-1 grid-cols-3 gap-[2vw]">
          <div className="flex flex-col border-t-[0.5vw] border-primary bg-white p-[2.2vw]">
            <div className="mono text-[0.95vw] uppercase tracking-[0.14em] text-slate-400">01 / baseline</div>
            <h3 className="mt-[3vh] text-[2.4vw] font-black leading-[1] tracking-[-0.05em]">Starter ISP</h3>
            <p className="mt-[3vh] text-[1.48vw] leading-[1.32] text-muted">Platform Core, Network Device Manager, Carol AI, Policy Studio, and basic AAA visibility</p>
            <div className="mt-auto h-[1px] w-[7vw] bg-primary" />
          </div>
          <div className="flex flex-col border-t-[0.5vw] border-slate-400 bg-[#eef3f7] p-[2.2vw]">
            <div className="mono text-[0.95vw] uppercase tracking-[0.14em] text-slate-400">02 / operations</div>
            <h3 className="mt-[3vh] text-[2.4vw] font-black leading-[1] tracking-[-0.05em]">Operations Pro</h3>
            <p className="mt-[3vh] text-[1.48vw] leading-[1.32] text-muted">VPN / sidecar, multi-vendor troubleshooting, tickets, appointments, backups, and limited guarded operations</p>
            <div className="mt-auto h-[1px] w-[7vw] bg-primary" />
          </div>
          <div className="flex flex-col border-t-[0.5vw] border-slate-300 bg-primary p-[2.2vw] text-white">
            <div className="mono text-[0.95vw] uppercase tracking-[0.14em] text-slate-300">03 / custom</div>
            <h3 className="mt-[3vh] text-[2.4vw] font-black leading-[1] tracking-[-0.05em]">Enterprise / Custom</h3>
            <p className="mt-[3vh] text-[1.48vw] leading-[1.32] text-slate-300">Custom automation, drivers, infrastructure, security, and support</p>
            <div className="mt-auto h-[1px] w-[7vw] bg-slate-400" />
          </div>
        </div>
        <div className="mt-[4vh] flex items-center justify-between border-t border-slate-200 pt-[2vh]">
          <div className="mono text-[0.82vw] text-slate-400">Tenant entitlements keep each deployment aligned to purchased capability</div>
          <div className="mono text-[0.82vw] font-semibold">07</div>
        </div>
      </div>
    </div>
  );
}