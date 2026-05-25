import { TabsList, TabsTrigger } from "./ui/tabs";

export function AuthToggle() {
  return (
    <TabsList className="grid h-13 w-full grid-cols-2 rounded-full border border-white/10 bg-white/10 p-1 text-white/70">
      <TabsTrigger
        value="login"
        className="rounded-full text-sm font-semibold data-[state=active]:border-transparent data-[state=active]:bg-[#f5ede4] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
      >
        Log in
      </TabsTrigger>
      <TabsTrigger
        value="signup"
        className="rounded-full text-sm font-semibold data-[state=active]:border-transparent data-[state=active]:bg-[#f5ede4] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
      >
        Sign up
      </TabsTrigger>
    </TabsList>
  );
}
