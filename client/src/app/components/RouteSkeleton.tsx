type RouteSkeletonProps = {
  routeKey?: string;
};

const shimmerClassName =
  "animate-pulse rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200";

const DashboardSkeleton = () => (
  <div className="mx-auto w-full max-w-[1320px] space-y-6">
    <div className={`h-32 w-full ${shimmerClassName}`} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={`h-32 w-full ${shimmerClassName}`} />
      ))}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <div className={`h-80 w-full ${shimmerClassName}`} />
      <div className={`h-80 w-full ${shimmerClassName}`} />
    </div>
  </div>
);

const ChatSkeleton = () => (
  <div className="mx-auto flex h-[100dvh] w-full max-w-[1320px] flex-col gap-5 overflow-hidden md:h-auto md:pb-4 lg:pb-0">
    <div className={`h-28 w-full ${shimmerClassName}`} />
    <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-h-[520px] flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-4">
          <div className={`h-16 w-3/4 ${shimmerClassName}`} />
          <div className={`ml-auto h-12 w-2/3 ${shimmerClassName}`} />
          <div className={`h-24 w-4/5 ${shimmerClassName}`} />
        </div>
        <div className="mt-auto flex gap-3">
          <div className={`h-14 flex-1 ${shimmerClassName}`} />
          <div className={`h-14 w-14 ${shimmerClassName}`} />
          <div className={`h-14 w-14 ${shimmerClassName}`} />
        </div>
      </div>
      <div className="hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <div className={`mb-4 h-8 w-1/2 ${shimmerClassName}`} />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={`h-16 w-full ${shimmerClassName}`} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const HomeSkeleton = () => (
  <div className="mx-auto w-full max-w-[1320px] space-y-8 px-4 py-8 md:px-6 md:py-10">
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="space-y-4">
        <div className={`h-6 w-40 ${shimmerClassName}`} />
        <div className={`h-16 w-full max-w-3xl ${shimmerClassName}`} />
        <div className={`h-6 w-full max-w-2xl ${shimmerClassName}`} />
        <div className="flex gap-3">
          <div className={`h-12 w-40 ${shimmerClassName}`} />
          <div className={`h-12 w-40 ${shimmerClassName}`} />
        </div>
      </div>
      <div className={`min-h-[320px] w-full ${shimmerClassName}`} />
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={`h-48 w-full ${shimmerClassName}`} />
      ))}
    </div>
  </div>
);

const GenericSkeleton = () => (
  <div className="mx-auto w-full max-w-[1320px] space-y-6 px-4 py-8 md:px-6 md:py-10">
    <div className={`h-10 w-56 ${shimmerClassName}`} />
    <div className={`h-5 w-full max-w-2xl ${shimmerClassName}`} />
    <div className="grid gap-4 md:grid-cols-2">
      <div className={`h-64 w-full ${shimmerClassName}`} />
      <div className={`h-64 w-full ${shimmerClassName}`} />
    </div>
  </div>
);

export function RouteSkeleton({ routeKey = "" }: RouteSkeletonProps) {
  if (routeKey === "/chat" || routeKey === "/android-yukti") {
    return <ChatSkeleton />;
  }

  if (routeKey === "/dashboard") {
    return <DashboardSkeleton />;
  }

  if (routeKey === "/" || routeKey === "/home" || routeKey === "/hero" || routeKey === "/Hero") {
    return <HomeSkeleton />;
  }

  return <GenericSkeleton />;
}
