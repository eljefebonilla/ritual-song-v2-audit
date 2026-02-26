import { GateForm } from "./gate-form";

export default function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <img
          src="/logo-stmonica-white.png"
          alt="St. Monica Catholic Community"
          className="mx-auto mb-2 w-48"
        />
        <p className="text-[10px] uppercase tracking-widest text-parish-gold mb-10">
          Mass Preparation
        </p>

        {/* Gate form */}
        <GateForm searchParams={searchParams} />

        <p className="mt-8 text-stone-500 text-xs">
          Enter the ministry access code to continue.
          <br />
          Contact your music director if you need the code.
        </p>
      </div>
    </div>
  );
}
