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
  const [queueStats, setQueueStats] = useState({ total: 0, waiting: 0, served: 0 });

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
        .eq("status", "served");

      setQueueStats({
        total: totalCount || 0,
        waiting: waitingCount || 0,
        served: servedCount || 0,
      });
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
    // Validation happens in the edge function, but we also validate here for better UX
    if (!newStaffEmail || !newStaffPassword || !newStaffName || !newStaffPhone) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newStaffPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to create staff accounts",
          variant: "destructive",
        });
        return;
      }

      // Call edge function to create staff atomically
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: { 
          email: newStaffEmail, 
          password: newStaffPassword, 
          fullName: newStaffName, 
          phoneNumber: newStaffPhone 
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Staff account created successfully",
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
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
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="counters">Counters</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
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
                      <p className="text-sm text-muted-foreground">Add a new service counter to the queue system</p>
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
                      <p className="text-sm text-muted-foreground">Add a new staff member to the system</p>
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
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteUser(staff.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
