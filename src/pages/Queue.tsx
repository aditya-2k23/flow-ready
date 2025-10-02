import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Users, Clock, Ticket, Bell, Loader2, CheckCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface QueueEntry {
  id: string;
  token_number: number;
  position_in_queue: number;
  status: string;
  estimated_wait_minutes: number | null;
  counter_id: string;
  counters: {
    counter_number: number;
    name: string;
  };
}

const Queue = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [totalInQueue, setTotalInQueue] = useState(0);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUser(user);
      await fetchQueueStatus(user.id);
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchQueueStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
        },
        async () => {
          await fetchQueueStatus(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchQueueStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('queue_entries')
      .select(`
        *,
        counters (
          counter_number,
          name
        )
      `)
      .eq('user_id', userId)
      .in('status', ['waiting', 'called'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching queue status:', error);
      return;
    }

    setQueueEntry(data);

    if (data) {
      const { count } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('counter_id', data.counter_id)
        .eq('status', 'waiting')
        .lt('position_in_queue', data.position_in_queue);

      setTotalInQueue(count || 0);

      if (count !== null && count <= 2 && data.status === 'waiting') {
        toast({
          title: "Almost your turn!",
          description: `Only ${count} ${count === 1 ? 'person' : 'people'} ahead of you. Please be ready.`,
          duration: 5000,
        });
      }
    }
  };

  const joinQueue = async () => {
    if (!user) return;
    
    setJoining(true);
    try {
      const { data: counters, error: countersError } = await supabase
        .from('counters')
        .select('id, counter_number')
        .eq('is_active', true);

      if (countersError) throw countersError;
      if (!counters || counters.length === 0) {
        throw new Error('No active counters available');
      }

      const counterCounts = await Promise.all(
        counters.map(async (counter) => {
          const { count } = await supabase
            .from('queue_entries')
            .select('*', { count: 'exact', head: true })
            .eq('counter_id', counter.id)
            .eq('status', 'waiting');
          return { counter, count: count || 0 };
        })
      );

      const selectedCounter = counterCounts.reduce((min, curr) =>
        curr.count < min.count ? curr : min
      );

      const { count: currentPosition } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('counter_id', selectedCounter.counter.id)
        .eq('status', 'waiting');

      const { count: totalTokens } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true });

      const tokenNumber = (totalTokens || 0) + 1;
      const positionInQueue = (currentPosition || 0) + 1;
      const estimatedWaitMinutes = positionInQueue * 2;

      const { error: insertError } = await supabase
        .from('queue_entries')
        .insert({
          user_id: user.id,
          counter_id: selectedCounter.counter.id,
          token_number: tokenNumber,
          position_in_queue: positionInQueue,
          estimated_wait_minutes: estimatedWaitMinutes,
          status: 'waiting',
        });

      if (insertError) throw insertError;

      toast({
        title: "Joined Queue!",
        description: `Your token number is ${tokenNumber}`,
      });

      await fetchQueueStatus(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to join queue",
        description: error.message,
      });
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
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
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Smart Queue</h1>
            <p className="text-sm opacity-90">Virtual Queue Management</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-white hover:bg-white/20"
          >
            <LogOut className="h-5 w-5" />
          </Button>
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
                Get a token number and track your position in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
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

                <div className="flex items-center gap-3 p-4 bg-accent rounded-lg">
                  <Clock className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Wait Time</p>
                    <p className="text-xl font-semibold">
                      {queueEntry.estimated_wait_minutes || 0} minutes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Ticket className="h-8 w-8 text-secondary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned Counter</p>
                    <p className="text-xl font-semibold">
                      Counter {queueEntry.counters.counter_number}
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Queue;
