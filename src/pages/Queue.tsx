import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Users, Clock, Ticket, Bell, Loader2, CheckCircle2, LogOut, Star } from "lucide-react";

interface QueueEntry {
  id: string;
  token_number: number;
  position_in_queue: number;
  status: string;
  estimated_wait_minutes: number | null;
  counter_id: string;
  counters?: {
    counter_number: number;
    name: string;
  };
}

const Queue = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    // Check if user has an active queue entry in localStorage
    const storedEntryId = localStorage.getItem("queueEntryId");
    if (storedEntryId) {
      fetchQueueEntry(storedEntryId);
    }

    const storedName = localStorage.getItem("queueUserName");
    const storedPhone = localStorage.getItem("queueUserPhone");
    if (storedName) setName(storedName);
    if (storedPhone) setPhone(storedPhone);
  }, []);

  useEffect(() => {
    if (!queueEntry) return;

    // Subscribe to real-time updates for the queue entry
    const channel = supabase
      .channel(`queue_entry_${queueEntry.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `id=eq.${queueEntry.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setQueueEntry(payload.new as QueueEntry);
            checkNotification(payload.new as QueueEntry);
          } else if (payload.eventType === "DELETE") {
            setShowFeedback(true);
            localStorage.removeItem("queueEntryId");
            setQueueEntry(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueEntry]);

  const fetchQueueEntry = async (entryId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("queue_entries")
        .select("*, counters(counter_number, name)")
        .eq("id", entryId)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.status === "waiting") {
        setQueueEntry(data);
        checkNotification(data);
        
        // Fetch count ahead
        const { count } = await supabase
          .from('queue_entries')
          .select('*', { count: 'exact', head: true })
          .eq('counter_id', data.counter_id)
          .eq('status', 'waiting')
          .lt('position_in_queue', data.position_in_queue);
        
        setTotalInQueue(count || 0);
      } else {
        // Entry doesn't exist or is not waiting anymore
        localStorage.removeItem("queueEntryId");
        setQueueEntry(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      localStorage.removeItem("queueEntryId");
    } finally {
      setLoading(false);
    }
  };

  const checkNotification = (entry: QueueEntry) => {
    if (entry.position_in_queue <= 3 && entry.status === "waiting") {
      toast({
        title: "Almost your turn!",
        description: `Only ${entry.position_in_queue - 1} people ahead of you. Please be ready.`,
        duration: 5000,
      });
    }
  };

  const joinQueue = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name and phone number",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      // Get the counter with the shortest queue
      const { data: counters, error: counterError } = await supabase
        .from("counters")
        .select("id")
        .eq("is_active", true);

      if (counterError) throw counterError;
      if (!counters || counters.length === 0) {
        throw new Error("No active counters available");
      }

      // Find counter with shortest queue
      const counterCounts = await Promise.all(
        counters.map(async (counter) => {
          const { count } = await supabase
            .from("queue_entries")
            .select("*", { count: "exact", head: true })
            .eq("counter_id", counter.id)
            .eq("status", "waiting");
          return { counter, count: count || 0 };
        })
      );

      const selectedCounter = counterCounts.reduce((min, curr) =>
        curr.count < min.count ? curr : min
      );

      // Get the next token number (global)
      const { data: lastEntry } = await supabase
        .from("queue_entries")
        .select("token_number")
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const tokenNumber = (lastEntry?.token_number || 0) + 1;

      // Get current queue length for position
      const { count } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("counter_id", selectedCounter.counter.id)
        .eq("status", "waiting");

      const position = (count || 0) + 1;

      const { data: newEntry, error: insertError } = await supabase
        .from("queue_entries")
        .insert({
          user_id: null, // Anonymous user
          counter_id: selectedCounter.counter.id,
          token_number: tokenNumber,
          position_in_queue: position,
          estimated_wait_minutes: position * 2,
        })
        .select("*, counters(counter_number, name)")
        .single();

      if (insertError) throw insertError;

      // Store the queue entry ID in localStorage
      localStorage.setItem("queueEntryId", newEntry.id);
      localStorage.setItem("queueUserName", name);
      localStorage.setItem("queueUserPhone", phone);

      setQueueEntry(newEntry);
      setTotalInQueue(0);

      toast({
        title: "Joined Queue",
        description: `Your token number is ${tokenNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const leaveQueue = async () => {
    if (!queueEntry) return;
    
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("queue_entries")
        .delete()
        .eq("id", queueEntry.id);

      if (error) throw error;

      toast({
        title: "Left Queue",
        description: "You have successfully left the queue.",
      });

      localStorage.removeItem("queueEntryId");
      setQueueEntry(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLeaving(false);
    }
  };

  const submitFeedback = () => {
    toast({
      title: "Thank you for your feedback!",
      description: "We appreciate your time.",
    });
    setShowFeedback(false);
    setRating(0);
    setFeedbackText("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-hero p-6 text-white shadow-lg">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold">Smart Queue</h1>
          <p className="text-sm opacity-90">No login required - Just join the queue</p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4 mt-4">
        {!queueEntry ? (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Join Virtual Queue
              </CardTitle>
              <CardDescription>
                Enter your details to get a token and track your position
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button
                onClick={joinQueue}
                disabled={joining}
                className="w-full h-14 text-lg bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow"
              >
                {joining ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-5 w-5" />
                    Join Queue Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="shadow-lg border-2 border-primary">
              <CardHeader className="bg-gradient-primary text-white">
                <CardTitle className="text-center text-3xl font-bold">
                  Token #{queueEntry.token_number}
                </CardTitle>
                <CardDescription className="text-center text-white/80">
                  {localStorage.getItem("queueUserName")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-secondary flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Position in Queue</p>
                      <p className="text-2xl font-bold">{queueEntry.position_in_queue}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Ahead of you</p>
                    <p className="text-xl font-semibold">{totalInQueue}</p>
                  </div>
                </div>

                {queueEntry.counters && (
                  <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-gradient-secondary flex items-center justify-center">
                      <span className="text-white font-bold">{queueEntry.counters.counter_number}</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned Counter</p>
                      <p className="text-xl font-semibold">{queueEntry.counters.name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-accent rounded-lg">
                  <Clock className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Wait Time</p>
                    <p className="text-xl font-semibold">
                      {queueEntry.estimated_wait_minutes || 0} minutes
                    </p>
                  </div>
                </div>

                {queueEntry.status === 'called' && (
                  <div className="flex items-center gap-3 p-4 bg-gradient-success text-white rounded-lg shadow-glow animate-pulse">
                    <Bell className="h-8 w-8" />
                    <div>
                      <p className="text-lg font-bold">It's Your Turn!</p>
                      <p className="text-sm opacity-90">Please proceed to your counter</p>
                    </div>
                  </div>
                )}

                {queueEntry.status === 'waiting' && totalInQueue === 0 && (
                  <div className="flex items-center gap-3 p-4 bg-warning/10 border-2 border-warning rounded-lg">
                    <CheckCircle2 className="h-8 w-8 text-warning" />
                    <div>
                      <p className="text-sm font-semibold">You're Next!</p>
                      <p className="text-xs text-muted-foreground">Please be ready</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={leaveQueue}
                  disabled={leaving}
                  variant="outline"
                  className="w-full mt-4"
                >
                  {leaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Leaving...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Leave Queue
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thank you for visiting!</DialogTitle>
            <DialogDescription>
              You have been served. We'd love to hear your feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Rate your experience</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="icon"
                    onClick={() => setRating(star)}
                    className="h-10 w-10"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="feedback">Additional Comments (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us about your experience..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submitFeedback} className="flex-1">
                Submit Feedback
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedback(false)}
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Queue;
