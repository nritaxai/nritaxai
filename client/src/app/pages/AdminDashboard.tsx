import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, Clock, DollarSign, MessageSquare, ShieldCheck, TrendingUp, Users, XCircle } from "lucide-react";
import { decideAdminCountryChangeRequest, getAdminCountryChangeRequests } from "../../utils/api";

type CountryChangeRequest = {
  _id: string;
  currentCountryName?: string;
  currentCountryCode?: string;
  requestedCountryName?: string;
  requestedCountryCode?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  user?: {
    name?: string;
    email?: string;
  };
};

const formatDate = (value?: string) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function AdminDashboard() {
  const [countryRequests, setCountryRequests] = useState<CountryChangeRequest[]>([]);
  const [countryRequestError, setCountryRequestError] = useState("");
  const [loadingCountryRequests, setLoadingCountryRequests] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState("");

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

  const loadCountryRequests = async () => {
    setLoadingCountryRequests(true);
    setCountryRequestError("");
    try {
      const response = await getAdminCountryChangeRequests();
      setCountryRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (error: any) {
      setCountryRequestError(error?.response?.data?.message || "Unable to load country change requests.");
    } finally {
      setLoadingCountryRequests(false);
    }
  };

  useEffect(() => {
    void loadCountryRequests();
  }, []);

  const decideRequest = async (requestId: string, decision: "approved" | "rejected") => {
    setReviewingRequestId(requestId);
    setCountryRequestError("");
    try {
      await decideAdminCountryChangeRequest(requestId, {
        decision,
        decisionNotes: decision === "approved" ? "Approved from admin dashboard." : "Rejected from admin dashboard.",
      });
      await loadCountryRequests();
    } catch (error: any) {
      setCountryRequestError(error?.response?.data?.message || `Unable to ${decision} country change request.`);
    } finally {
      setReviewingRequestId("");
    }
  };

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
        <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F172A]">
              <ShieldCheck className="size-4" />
              Country Change Approvals
            </CardTitle>
            <CardDescription className="text-[#0F172A]">
              Review locked signup country changes before pricing, tax workflow, and compliance settings update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {countryRequestError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {countryRequestError}
              </p>
            ) : null}
            {loadingCountryRequests ? (
              <p className="text-sm text-[#0F172A]">Loading country requests...</p>
            ) : countryRequests.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#E2E8F0] text-xs uppercase text-[#475569]">
                    <tr>
                      <th className="py-2 pr-3 font-medium">User</th>
                      <th className="py-2 pr-3 font-medium">Current</th>
                      <th className="py-2 pr-3 font-medium">Requested</th>
                      <th className="py-2 pr-3 font-medium">Reason</th>
                      <th className="py-2 pr-3 font-medium">Requested</th>
                      <th className="py-2 pr-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryRequests.map((request) => (
                      <tr key={request._id} className="border-b border-[#E2E8F0]/70">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-[#0F172A]">{request.user?.name || "Unknown user"}</p>
                          <p className="text-xs text-[#475569]">{request.user?.email || "No email"}</p>
                        </td>
                        <td className="py-3 pr-3 text-[#0F172A]">
                          {request.currentCountryName || "Not set"} ({request.currentCountryCode || "NA"})
                        </td>
                        <td className="py-3 pr-3 text-[#0F172A]">
                          {request.requestedCountryName || "Not set"} ({request.requestedCountryCode || "NA"})
                        </td>
                        <td className="max-w-[240px] py-3 pr-3 text-[#475569]">
                          {request.reason || "No reason provided"}
                        </td>
                        <td className="py-3 pr-3 text-[#475569]">{formatDate(request.createdAt)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void decideRequest(request._id, "approved")}
                              disabled={Boolean(reviewingRequestId)}
                            >
                              <CheckCircle className="mr-1 size-3" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void decideRequest(request._id, "rejected")}
                              disabled={Boolean(reviewingRequestId)}
                            >
                              <XCircle className="mr-1 size-3" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#0F172A]">No pending country change requests.</p>
            )}
          </CardContent>
        </Card>

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









