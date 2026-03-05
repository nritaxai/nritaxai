import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, Clock, DollarSign, MessageSquare, TrendingUp, Users } from "lucide-react";

export function AdminDashboard() {
  const stats = [
    { title: "Total Users", value: "2,847", change: "+12.5%", icon: Users },
    { title: "AI Conversations", value: "18,392", change: "+23.1%", icon: MessageSquare },
    { title: "Revenue (USD)", value: "$82,450", change: "+18.2%", icon: DollarSign },
    { title: "Active Subscriptions", value: "1,234", change: "+8.7%", icon: TrendingUp },
  ];

  const recentActivity = [
    { user: "john@example.com", action: "Subscribed to Pro", time: "2 min ago", status: "success" },
    { user: "sarah@example.com", action: "Started AI chat", time: "5 min ago", status: "info" },
    { user: "mike@example.com", action: "Booked CPA consultation", time: "12 min ago", status: "success" },
    { user: "emma@example.com", action: "Used tax calculator", time: "18 min ago", status: "info" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/82">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Admin Dashboard</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            Monitor platform performance, usage, and consultation pipeline in one workbench.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#0F172A]">{stat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-2xl text-[#0F172A]">{stat.value}</p>
                  <div className="inline-flex size-9 items-center justify-center rounded-lg bg-[#3b82f6] text-[#2563eb]">
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="text-xs text-[#2563eb]">{stat.change} from last month</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F172A]">
              <Clock className="size-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={`${activity.user}-${activity.time}`} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F7FAFC]/70 p-3">
                <div>
                  <p className="text-sm text-[#0F172A]">{activity.user}</p>
                  <p className="text-xs text-[#0F172A]">{activity.action}</p>
                </div>
                <div className="text-right">
                  <Badge className={activity.status === "success" ? "bg-[#1d4ed8] text-[#2563eb]" : "bg-[#3b82f6] text-[#2563eb]"}>
                    {activity.status === "success" ? <CheckCircle className="mr-1 size-3" /> : null}
                    {activity.status}
                  </Badge>
                  <p className="mt-1 text-xs text-[#0F172A]">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
          <CardHeader>
            <CardTitle className="text-[#0F172A]">AI Chat Performance</CardTitle>
            <CardDescription className="text-[#0F172A]">Rolling 30-day quality indicators.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 p-3">
              <p className="text-xs text-[#0F172A]">Total Conversations</p>
              <p className="mt-1 text-2xl text-[#0F172A]">18,392</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 p-3">
              <p className="text-xs text-[#0F172A]">Avg. Messages / Chat</p>
              <p className="mt-1 text-2xl text-[#0F172A]">8.4</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 p-3">
              <p className="text-xs text-[#0F172A]">User Satisfaction</p>
              <p className="mt-1 text-2xl text-[#0F172A]">94%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}









