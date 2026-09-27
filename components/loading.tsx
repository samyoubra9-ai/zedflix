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
    <div className="relative h-[78vh] min-h-[520px] skeleton">
      <div className="absolute bottom-24 left-6 space-y-4 md:left-12">
        <div className="h-4 w-16 rounded bg-white/10" />
        <div className="h-12 w-72 rounded bg-white/10 md:w-96" />
        <div className="h-4 w-80 rounded bg-white/10" />
        <div className="h-12 w-32 rounded bg-white/15" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="w-36 shrink-0 sm:w-44">
          <div className="aspect-[2/3] rounded-md skeleton" />
          <div className="mt-2 h-3 w-24 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>
          <div className="aspect-[2/3] rounded-md skeleton" />
          <div className="mt-2 h-3 w-2/3 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div>
      <HeroSkeleton />
      <div className="space-y-8 px-6 py-8 md:px-12">
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
