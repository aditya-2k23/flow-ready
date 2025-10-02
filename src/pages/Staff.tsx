import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Users, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Counter {
  id: string;
  counter_number: number;
  name: string;
  is_active: boolean;
}

interface QueueEntry {
  id: string;
  token_number: number;
  position_in_queue: number;
  status: string;
  profiles: {
    full_name: string;
    phone_number: string;
  };
}

const Staff = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<Counter | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [serving, setServing] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'staff') {
        navigate('/queue');
        return;
      }

      setUser(user);
      await fetchCounters();
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!selectedCounter) return;

    fetchQueueEntries();

    const channel = supabase
      .channel('staff-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `counter_id=eq.${selectedCounter.id}`,
        },
        () => {
          fetchQueueEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCounter]);

  const fetchCounters = async () => {
    const { data, error } = await supabase
      .from('counters')
      .select('*')
      .eq('is_active', true)
      .order('counter_number');

    if (error) {
      console.error('Error fetching counters:', error);
      return;
    }

    setCounters(data || []);
  };

  const fetchQueueEntries = async () => {
    if (!selectedCounter) return;

    const { data: entries, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('counter_id', selectedCounter.id)
      .eq('status', 'waiting')
      .order('position_in_queue');

    if (error) {
      console.error('Error fetching queue entries:', error);
      return;
    }

    if (!entries || entries.length === 0) {
      setQueueEntries([]);
      return;
    }

    const userIds = entries.map(e => e.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      setQueueEntries([]);
      return;
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const entriesWithProfiles = entries.map(entry => ({
      ...entry,
      profiles: profileMap.get(entry.user_id) || { full_name: 'Unknown', phone_number: '' }
    }));

    setQueueEntries(entriesWithProfiles as QueueEntry[]);
  };

  const handleServeNext = async () => {
    if (!selectedCounter || queueEntries.length === 0) return;

    setServing(true);
    try {
      const nextEntry = queueEntries[0];

      const { error: updateError } = await supabase
        .from('queue_entries')
        .update({
          status: 'served',
          served_at: new Date().toISOString(),
        })
        .eq('id', nextEntry.id);

      if (updateError) throw updateError;

      const { error: reorderError } = await supabase.rpc('reorder_queue_positions', {
        p_counter_id: selectedCounter.id,
      });

      if (reorderError && reorderError.code !== 'PGRST204') {
        console.error('Error reordering queue:', reorderError);
      }

      toast({
        title: "Customer Served",
        description: `Token #${nextEntry.token_number} has been served`,
      });

      await fetchQueueEntries();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setServing(false);
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
      <div className="bg-gradient-secondary p-6 text-white shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Staff Panel</h1>
            <p className="text-sm opacity-90">Queue Management</p>
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
        {!selectedCounter ? (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Select Your Counter</CardTitle>
              <CardDescription>Choose which counter you'll be managing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {counters.map((counter) => (
                <Button
                  key={counter.id}
                  onClick={() => setSelectedCounter(counter)}
                  className="w-full h-14 text-lg justify-between bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  <span>{counter.name}</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="shadow-lg border-2 border-secondary">
              <CardHeader className="bg-gradient-secondary text-white">
                <CardTitle className="text-center text-2xl">
                  {selectedCounter.name}
                </CardTitle>
                <CardDescription className="text-center text-white/80">
                  {queueEntries.length} {queueEntries.length === 1 ? 'person' : 'people'} waiting
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Button
                  onClick={() => setSelectedCounter(null)}
                  variant="outline"
                  className="w-full mb-4"
                >
                  Change Counter
                </Button>

                {queueEntries.length > 0 ? (
                  <>
                    <div className="mb-4 p-4 bg-gradient-primary text-white rounded-lg shadow-md">
                      <p className="text-sm opacity-90 mb-1">Next Customer</p>
                      <p className="text-3xl font-bold mb-2">
                        Token #{queueEntries[0].token_number}
                      </p>
                      <p className="text-sm">{queueEntries[0].profiles.full_name}</p>
                      <p className="text-xs opacity-75">{queueEntries[0].profiles.phone_number}</p>
                    </div>

                    <Button
                      onClick={handleServeNext}
                      disabled={serving}
                      className="w-full h-14 text-lg bg-gradient-success hover:opacity-90 transition-opacity shadow-glow"
                    >
                      {serving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Serve Next Customer
                        </>
                      )}
                    </Button>

                    {queueEntries.length > 1 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">
                          Upcoming ({queueEntries.length - 1})
                        </p>
                        {queueEntries.slice(1, 4).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-semibold">Token #{entry.token_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {entry.profiles.full_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Position</p>
                              <p className="font-semibold">{entry.position_in_queue}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-semibold text-muted-foreground">
                      No customers in queue
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Waiting for customers to join...
                    </p>
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

export default Staff;
