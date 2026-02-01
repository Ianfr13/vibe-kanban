import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { defineModal, type NoProps } from '@/lib/modals';
import { swarmApi } from '@/lib/api';
import type { Swarm } from 'shared/types';

export type CreateSwarmResult = {
  action: 'created' | 'canceled';
  swarm?: Swarm;
};

const CreateSwarmDialogImpl = NiceModal.create<NoProps>(() => {
  const modal = useModal();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (modal.visible) {
      setName('');
      setDescription('');
      setError(null);
      setIsCreating(false);
    }
  }, [modal.visible]);

  const validateName = (value: string): string | null => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return 'Swarm name is required';
    if (trimmedValue.length < 3) return 'Swarm name must be at least 3 characters';
    if (trimmedValue.length > 100) return 'Swarm name must be 100 characters or less';
    return null;
  };

  const handleCreate = async () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const swarm = await swarmApi.create({
        name: name.trim(),
        description: description.trim() || null,
        project_id: null,
      });
      modal.resolve({
        action: 'created',
        swarm,
      } as CreateSwarmResult);
      modal.hide();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create swarm');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    modal.resolve({ action: 'canceled' } as CreateSwarmResult);
    modal.hide();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  return (
    <Dialog open={modal.visible} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Swarm</DialogTitle>
          <DialogDescription>
            Create a swarm to orchestrate distributed tasks across multiple sandboxes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="swarm-name">Name</Label>
            <Input
              id="swarm-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="My Swarm"
              maxLength={100}
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="swarm-description">Description (optional)</Label>
            <Textarea
              id="swarm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this swarm will do..."
              rows={3}
              disabled={isCreating}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create Swarm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const CreateSwarmDialog = defineModal<void, CreateSwarmResult>(CreateSwarmDialogImpl);
