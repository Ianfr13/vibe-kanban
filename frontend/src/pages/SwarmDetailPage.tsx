import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { SwarmDetail } from '@/components/swarm';
import { swarmApi } from '@/lib/api';
import type { Swarm, SwarmTask, Sandbox, SwarmChatMessage } from '@/components/swarm/types';

export function SwarmDetailPage() {
  const { swarmId } = useParams<{ swarmId: string }>();
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [messages, setMessages] = useState<SwarmChatMessage[]>([]);
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSwarmData = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const [swarmData, tasksData, messagesData] = await Promise.all([
        swarmApi.get(id),
        swarmApi.getTasks(id),
        swarmApi.getMessages(id),
      ]);
      setSwarm(swarmData);
      setTasks(tasksData);
      const chatMessages: SwarmChatMessage[] = messagesData.map((msg) => ({
        id: msg.id,
        swarm_id: msg.swarm_id,
        sender_type: msg.sender_type as 'system' | 'user' | 'sandbox',
        sender_id: msg.sender_id,
        message: msg.message,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        created_at: msg.created_at instanceof Date ? msg.created_at.toISOString() : String(msg.created_at),
      }));
      setMessages(chatMessages);
      setSandboxes([]);
    } catch (error) {
      console.error('Failed to load swarm data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (swarmId) {
      loadSwarmData(swarmId);
    }
  }, [swarmId, loadSwarmData]);

  const handlePause = async () => {
    if (!swarmId) return;
    try {
      const updated = await swarmApi.pause(swarmId);
      setSwarm(updated);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Swarm paused`]);
    } catch (error) {
      console.error('Failed to pause swarm:', error);
    }
  };

  const handleResume = async () => {
    if (!swarmId) return;
    try {
      const updated = await swarmApi.resume(swarmId);
      setSwarm(updated);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Swarm resumed`]);
    } catch (error) {
      console.error('Failed to resume swarm:', error);
    }
  };

  const handleSettings = () => {
    // TODO: Open settings dialog
    console.log('Open settings');
  };

  const handleCreateTask = async () => {
    if (!swarmId) return;
    try {
      const newTask = await swarmApi.createTask(swarmId, {
        title: 'New Task',
        description: null,
        priority: 'medium',
        depends_on: null,
        tags: null,
      });
      setTasks((prev) => [...prev, newTask]);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Task created: ${newTask.title}`]);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!swarmId) return;
    try {
      const newMessage = await swarmApi.postMessage(swarmId, {
        sender_type: 'user',
        message,
      });
      const chatMessage: SwarmChatMessage = {
        id: newMessage.id,
        swarm_id: newMessage.swarm_id,
        sender_type: newMessage.sender_type as 'system' | 'user' | 'sandbox',
        sender_id: newMessage.sender_id,
        message: newMessage.message,
        metadata: newMessage.metadata ? JSON.parse(newMessage.metadata) : null,
        created_at: newMessage.created_at instanceof Date
          ? newMessage.created_at.toISOString()
          : String(newMessage.created_at),
      };
      setMessages((prev) => [...prev, chatMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleViewExecution = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Viewing execution for task: ${task.title}`]);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    if (!swarmId) return;
    try {
      await swarmApi.updateTask(swarmId, taskId, {
        title: null,
        description: null,
        status: 'pending',
        priority: null,
        sandbox_id: null,
        depends_on: null,
        triggers_after: null,
        result: null,
        error: null,
        tags: null,
      });
      await loadSwarmData(swarmId);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Task retried: ${taskId}`]);
    } catch (error) {
      console.error('Failed to retry task:', error);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!swarmId) return;
    try {
      await swarmApi.updateTask(swarmId, taskId, {
        title: null,
        description: null,
        status: 'cancelled',
        priority: null,
        sandbox_id: null,
        depends_on: null,
        triggers_after: null,
        result: null,
        error: null,
        tags: null,
      });
      await loadSwarmData(swarmId);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Task cancelled: ${taskId}`]);
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const handleDestroySandbox = (id: string) => {
    // TODO: Implement sandbox destruction via API
    setSandboxes((prev) => prev.filter((s) => s.id !== id));
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] Sandbox destroyed: ${id}`]);
  };

  const handleCleanupIdle = () => {
    // TODO: Implement idle sandbox cleanup via API
    const idleSandboxes = sandboxes.filter((s) => s.status === 'idle');
    setSandboxes((prev) => prev.filter((s) => s.status !== 'idle'));
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] Cleaned up ${idleSandboxes.length} idle sandboxes`]);
  };

  if (!swarm && !isLoading) {
    return <div className="p-6">Swarm not found</div>;
  }

  if (!swarm) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="h-[calc(100vh-48px)]">
      <SwarmDetail
        swarm={swarm}
        tasks={tasks}
        messages={messages}
        sandboxes={sandboxes}
        logs={logs}
        isLoading={isLoading}
        onPause={handlePause}
        onResume={handleResume}
        onSettings={handleSettings}
        onCreateTask={handleCreateTask}
        onSendMessage={handleSendMessage}
        onViewExecution={handleViewExecution}
        onRetryTask={handleRetryTask}
        onCancelTask={handleCancelTask}
        onDestroySandbox={handleDestroySandbox}
        onCleanupIdle={handleCleanupIdle}
      />
    </div>
  );
}
