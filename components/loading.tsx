export function Spinner({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`}
      role="status"
      aria-label="Chargement"
    />
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[58vh] min-h-[340px] skeleton sm:h-[70vh] sm:min-h-[460px] md:h-[78vh] md:min-h-[520px]">
      <div className="absolute bottom-10 left-4 space-y-3 sm:bottom-24 sm:left-6 md:left-12">
        <div className="h-3 w-14 rounded bg-white/10 sm:h-4 sm:w-16" />
        <div className="h-8 w-48 rounded bg-white/10 sm:h-12 sm:w-72 md:w-96" />
        <div className="h-3 w-56 rounded bg-white/10 sm:h-4 sm:w-80" />
        <div className="h-10 w-28 rounded bg-white/15 sm:h-12 sm:w-32" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-hidden sm:gap-3">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="w-[30vw] max-w-[9.5rem] min-w-[6.5rem] shrink-0 sm:w-40 sm:max-w-none">
          <div className="aspect-[2/3] rounded-lg skeleton" />
          <div className="mt-2 h-3 w-20 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>
          <div className="aspect-[2/3] rounded-lg skeleton" />
          <div className="mt-2 h-3 w-2/3 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="pb-24 md:pb-0">
      <HeroSkeleton />
      <div className="space-y-7 px-4 py-6 sm:space-y-8 sm:px-8 md:px-12">
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}

export function PlayerSkeleton() {
  return (
    <main className="flex h-screen items-center justify-center bg-black">
      <Spinner className="h-12 w-12" />
    </main>
  );
}
