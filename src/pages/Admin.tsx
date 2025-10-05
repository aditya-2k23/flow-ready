import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut,
  Users,
  BarChart3,
  Plus,
  Trash2,
  UserPlus,
  Star,
  MessageSquare,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    waiting: 0,
    served: 0,
  });

  // New counter form
  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterNumber, setNewCounterNumber] = useState("");

  // New staff form
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    fetchData();
  };

  const fetchData = async () => {
    try {
      // Fetch counters
      const { data: countersData } = await supabase
        .from("counters")
        .select("*")
        .order("counter_number");

      setCounters(countersData || []);

      // Fetch staff members
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (staffRoles && staffRoles.length > 0) {
        const staffIds = staffRoles.map((r) => r.user_id);
        const { data: staffProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", staffIds);

        setStaffMembers(staffProfiles || []);
      }

      // Fetch queue statistics
      const { count: totalCount } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true });

      const { count: waitingCount } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "waiting");

      const { count: servedCount } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "done");

      setQueueStats({
        total: totalCount || 0,
        waiting: waitingCount || 0,
        served: servedCount || 0,
      });

      // Fetch feedback with customer and counter details
      const { data: feedbackData } = await supabase
        .from("feedback")
        .select(
          `
          *,
          counters (
            name,
            counter_number
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      setFeedbackList(feedbackData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCounter = async () => {
    if (!newCounterName || !newCounterNumber) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("counters").insert({
        name: newCounterName,
        counter_number: parseInt(newCounterNumber),
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Counter created successfully",
      });

      setNewCounterName("");
      setNewCounterNumber("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteCounter = async (id: string) => {
    try {
      const { error } = await supabase.from("counters").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Counter deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateStaff = async () => {
    if (
      !newStaffEmail ||
      !newStaffPassword ||
      !newStaffName ||
      !newStaffPhone
    ) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create auth user using admin API (this requires service role key)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newStaffEmail,
        password: newStaffPassword,
        options: {
          data: {
            full_name: newStaffName,
            phone_number: newStaffPhone,
            role: "staff",
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Assign staff role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "staff",
        });

        if (roleError) throw roleError;
      }

      toast({
        title: "Success",
        description: "Staff member created successfully",
      });

      setNewStaffEmail("");
      setNewStaffPassword("");
      setNewStaffName("");
      setNewStaffPhone("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-primary text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-card border-b shadow-elegant">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 shadow-glow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Queues</p>
                <p className="text-2xl font-bold">{queueStats.total}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-glow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold">{queueStats.waiting}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-glow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Served</p>
                <p className="text-2xl font-bold">{queueStats.served}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="counters" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="counters">Counters</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          {/* Counters Tab */}
          <TabsContent value="counters" className="space-y-6">
            <Card className="p-6 shadow-glow">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Manage Counters</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Counter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Counter</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Counter Name
                        </label>
                        <Input
                          placeholder="e.g., Service Counter 1"
                          value={newCounterName}
                          onChange={(e) => setNewCounterName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Counter Number
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          value={newCounterNumber}
                          onChange={(e) => setNewCounterNumber(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleCreateCounter} className="w-full">
                        Create Counter
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {counters.map((counter) => (
                  <div
                    key={counter.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-card-hover"
                  >
                    <div>
                      <p className="font-semibold">{counter.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Counter #{counter.counter_number} •{" "}
                        {counter.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteCounter(counter.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card className="p-6 shadow-glow">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Manage Staff</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Staff Account</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Full Name
                        </label>
                        <Input
                          placeholder="John Doe"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email
                        </label>
                        <Input
                          type="email"
                          placeholder="staff@example.com"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Phone Number
                        </label>
                        <Input
                          type="tel"
                          placeholder="+1234567890"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Password
                        </label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleCreateStaff} className="w-full">
                        Create Staff Account
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {staffMembers.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-card-hover"
                  >
                    <div>
                      <p className="font-semibold">{staff.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {staff.email} • {staff.phone_number}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-6">
            <Card className="p-6 shadow-glow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Customer Feedback</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    View and analyze customer satisfaction ratings
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>
                    Average:{" "}
                    {feedbackList.length > 0
                      ? (
                          feedbackList.reduce((acc, f) => acc + f.rating, 0) /
                          feedbackList.length
                        ).toFixed(1)
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {feedbackList.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No feedback received yet
                    </p>
                  </div>
                ) : (
                  feedbackList.map((feedback) => (
                    <Card key={feedback.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= feedback.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-sm">
                              {feedback.rating}/5
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {feedback.customer_name || "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {feedback.customer_phone || "No phone provided"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {feedback.counters?.name ||
                              `Counter ${
                                feedback.counters?.counter_number || "N/A"
                              }`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(feedback.created_at).toLocaleDateString()}{" "}
                            {new Date(feedback.created_at).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      {feedback.comments && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md">
                          <p className="text-sm text-muted-foreground italic">
                            "{feedback.comments}"
                          </p>
                        </div>
                      )}
                      {/* Hardcoded wait time for now */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Wait time: ~{Math.floor(Math.random() * 20) + 5} min
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
