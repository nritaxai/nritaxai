import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function HeroPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      navigate("/home", { replace: true });
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [navigate]);

  return (
    <div
      className="relative flex min-h-screen cursor-pointer items-center justify-center overflow-hidden bg-gradient-to-b from-white via-[#EFF6FF] to-[#DBEAFE]"
      onClick={() => navigate("/home", { replace: true })}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate("/home", { replace: true });
        }
      }}
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2563eb]/16 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#1D4ED8]/18 blur-3xl" />

      <div className="relative -translate-y-16 flex w-full max-w-5xl flex-col items-center px-6 text-center sm:-translate-y-20">
        <img
          src="/logo-transparent.png"
          alt="NRITAX logo"
          className="-ml-4 -mb-16 h-56 w-auto object-contain sm:-ml-6 sm:-mb-20 sm:h-72 lg:-ml-8 lg:-mb-24 lg:h-80"
        />
        <p className="mb-3 rounded-full border border-[#BFDBFE] bg-white/70 px-4 py-1 text-xs tracking-[0.24em] text-[#2563EB]">
          AI TAX PLATFORM FOR NRIS
        </p>
        <h1 className="text-4xl tracking-tight text-[#0F172A] sm:text-6xl">
          NRITAX<span className="text-[#2563eb]">.AI</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[#334155] sm:text-lg">
          Smart NRI tax guidance, instant AI help, and practical next steps in one place.
        </p>
        <div className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/80">
          <div className="h-full w-full rounded-full bg-[#2563EB] animate-pulse" />
        </div>
        <p className="mt-4 text-sm text-[#475569]">Loading website...</p>
      </div>
    </div>
  );
}
