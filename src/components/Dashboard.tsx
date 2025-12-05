import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Send, MessageSquare, AlertCircle, Code2 } from "lucide-react";
import { Link } from "react-router-dom";

export const Dashboard = () => {
  // Mock data - in production, this would come from your state files
  const stats = {
    totalProposals: 40,
    proposalsSent: 27,
    followUpsSent: 12,
    failed: 1,
    pending: 13,
  };

  const recentActivity = [
    { name: "Akshat Tripathi", status: "success", type: "followup", time: "2 mins ago" },
    { name: "Rashi Agrawal", status: "success", type: "followup", time: "3 mins ago" },
    { name: "Raheel Ragaa", status: "success", type: "followup", time: "4 mins ago" },
    { name: "Sanjana Sharma", status: "failed", type: "followup", time: "5 mins ago" },
    { name: "Mohor Daimary", status: "success", type: "followup", time: "6 mins ago" },
  ];

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">LinkedIn Automation Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitor your proposal and follow-up campaigns</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild size="sm">
                <Link to="/fixes" className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  View Code Fixes
                </Link>
              </Button>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Live Monitoring
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardDescription>Total Conversations</CardDescription>
              <CardTitle className="text-3xl text-primary">{stats.totalProposals}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4 mr-2" />
                Checked conversations
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardDescription>Proposals Sent</CardDescription>
              <CardTitle className="text-3xl text-success">{stats.proposalsSent}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <Send className="w-4 h-4 mr-2" />
                Successfully submitted
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-info">
            <CardHeader className="pb-3">
              <CardDescription>Follow-ups Sent</CardDescription>
              <CardTitle className="text-3xl text-info">{stats.followUpsSent}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Automated responses
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-warning">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mr-2" />
                Awaiting action
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automation Pipeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Automation Pipeline</CardTitle>
            <CardDescription>3-stage LinkedIn automation workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stage 1: Submit Proposals</span>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-success h-2.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground">Automated proposal submission to LinkedIn Service Marketplace requests</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stage 2: Send Follow-ups</span>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-success h-2.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground">Follow-up messages to prospects who haven't replied</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stage 3: Resume Processing & Email</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary text-xs">New</Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full" style={{ width: '10%' }}></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Downloads resumes → ChatGPT critique → Personalized email with dynamic pricing
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest automation actions and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {activity.status === "success" ? (
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-destructive" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">{activity.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.type === "followup" ? "Follow-up message" : "Proposal submitted"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={activity.status === "success" ? "default" : "destructive"}
                      className={
                        activity.status === "success"
                          ? "bg-success hover:bg-success/80"
                          : ""
                      }
                    >
                      {activity.status === "success" ? "Sent" : "Failed"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Issues Alert */}
        {stats.failed > 0 && (
          <Card className="mt-6 border-l-4 border-l-destructive">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <CardTitle className="text-destructive">Action Required</CardTitle>
              </div>
              <CardDescription>Some messages failed to send and need attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-medium text-foreground">Sanjana Sharma</p>
                  <p className="text-sm text-muted-foreground">Could not find message input box</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Solution:</strong> The message input may be hidden or the conversation page structure changed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips Section */}
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Optimization Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Wait for send button to become enabled after typing message</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Verify proposal signature before sending follow-ups</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Add delay after message input to ensure button activation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Use more specific selectors for the send button state</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
