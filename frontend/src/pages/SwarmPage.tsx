import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwarmList } from '@/components/swarm';
import { swarmApi } from '@/lib/api';
import type { Swarm } from '@/components/swarm/types';
import { CreateSwarmDialog } from '@/components/dialogs/swarm/CreateSwarmDialog';

export function SwarmPage() {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSwarms();
  }, []);

  const loadSwarms = async () => {
    try {
      setIsLoading(true);
      const data = await swarmApi.list();
      setSwarms(data);
    } catch (error) {
      console.error('Failed to load swarms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSwarm = async () => {
    const result = await CreateSwarmDialog.show();
    if (result.action === 'created' && result.swarm) {
      setSwarms([...swarms, result.swarm]);
      navigate(`/swarm/${result.swarm.id}`);
    }
  };

  const handlePauseSwarm = async (id: string) => {
    try {
      await swarmApi.pause(id);
      await loadSwarms();
    } catch (error) {
      console.error('Failed to pause swarm:', error);
    }
  };

  const handleResumeSwarm = async (id: string) => {
    try {
      await swarmApi.resume(id);
      await loadSwarms();
    } catch (error) {
      console.error('Failed to resume swarm:', error);
    }
  };

  return (
    <div className="p-6">
      <SwarmList
        swarms={swarms}
        isLoading={isLoading}
        onCreateSwarm={handleCreateSwarm}
        onPauseSwarm={handlePauseSwarm}
        onResumeSwarm={handleResumeSwarm}
      />
    </div>
  );
}
