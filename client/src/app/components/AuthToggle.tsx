import { TabsList, TabsTrigger } from "./ui/tabs";

export function AuthToggle() {
  return (
    <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1 text-slate-600">
      <TabsTrigger
        value="login"
        className="rounded-lg text-sm font-medium data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
      >
        Sign In
      </TabsTrigger>
      <TabsTrigger
        value="signup"
        className="rounded-lg text-sm font-medium data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
      >
        Create Account
      </TabsTrigger>
    </TabsList>
  );
}
