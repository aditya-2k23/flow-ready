import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Clock, Bell, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center text-white space-y-8">
          <div className="space-y-4">
            <div className="inline-block p-4 bg-white/10 backdrop-blur-sm rounded-full mb-4">
              <Users className="h-16 w-16" />
            </div>
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
              Smart Queue
            </h1>
            <p className="text-xl opacity-90 mb-8">
              Skip the physical line. Join our virtual queue and track your position in real-time.
            </p>
          </div>

          <div className="space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-start gap-3 text-left">
              <Clock className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Real-Time Updates</h3>
                <p className="text-sm opacity-80">Track your position and estimated wait time</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Bell className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Smart Notifications</h3>
                <p className="text-sm opacity-80">Get notified when it's almost your turn</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Users className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Multiple Counters</h3>
                <p className="text-sm opacity-80">Automatically assigned to the shortest queue</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="w-full h-14 text-lg bg-white text-primary hover:bg-white/90 transition-all shadow-lg hover:shadow-xl"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <p className="text-sm opacity-75">
            Join thousands of satisfied customers enjoying hassle-free queuing
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
