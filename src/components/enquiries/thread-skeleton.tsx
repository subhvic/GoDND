/** The thread's shape while it loads: header, a few bubbles, the composer. */
export function ThreadSkeleton() {
  return (
    <div className="thread thread-loading" aria-busy="true">
      <div className="thread-head">
        <span aria-hidden className="skeleton size-[34px] shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <span aria-hidden className="skeleton h-[14px] w-[160px]" />
          <span aria-hidden className="skeleton h-[11px] w-[220px] max-w-full" />
        </div>
      </div>
      <div className="thread-scroll">
        <div className="thread-inner">
          {[
            ["in", "w-[62%]", "h-[56px]"],
            ["out", "w-[48%]", "h-[40px]"],
            ["in", "w-[70%]", "h-[72px]"],
            ["out", "w-[40%]", "h-[40px]"],
          ].map(([side, width, height], index) => (
            <div key={index} className={`flex ${side === "out" ? "justify-end" : "justify-start"}`}>
              <span aria-hidden className={`skeleton rounded-[12px] ${width} ${height}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="composer">
        <span aria-hidden className="skeleton block h-[72px] w-full" />
      </div>
      <p className="sr-only" role="status">
        Loading conversation…
      </p>
    </div>
  );
}
