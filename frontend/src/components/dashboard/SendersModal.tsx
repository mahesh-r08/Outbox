import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Skeleton } from '../ui/Skeleton.js';
import { getSenders, createSender, deleteSender } from '../../api/senderApi.js';
import type { Sender } from '../../types/index.js';

export interface SendersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SendersModal: React.FC<SendersModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const defaultHost = import.meta.env.VITE_DEFAULT_SMTP_HOST || 'smtp.ethereal.email';
  const defaultPort = Number(import.meta.env.VITE_DEFAULT_SMTP_PORT) || 587;

  const [customForm, setCustomForm] = useState({
    name: '',
    email: '',
    smtpHost: defaultHost,
    smtpPort: defaultPort,
    smtpUser: '',
    smtpPassword: '',
    hourlyLimit: 200,
  });

  const { data: senders = [], isLoading } = useQuery({
    queryKey: ['senders'],
    queryFn: getSenders,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: createSender,
    onSuccess: (newSender) => {
      toast.success(`Mailbox added: ${newSender.email}`);
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setIsAddingCustom(false);
      setCustomForm({
        name: '',
        email: '',
        smtpHost: defaultHost,
        smtpPort: defaultPort,
        smtpUser: '',
        smtpPassword: '',
        hourlyLimit: 200,
      });
    },
    onError: (err: any) => {
      toast.error(err.customMessage || 'Failed to create sender');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSender,
    onSuccess: () => {
      toast.success('Sender removed');
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
    onError: (err: any) => {
      toast.error(err.customMessage || 'Failed to delete sender');
    },
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.name || !customForm.email || !customForm.smtpUser || !customForm.smtpPassword) {
      toast.error('Please fill in all SMTP credentials');
      return;
    }

    createMutation.mutate({
      ...customForm,
      autoProvisionEthereal: false,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mailboxes"
      subtitle="Manage connected email sending accounts and rate limits"
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">
            Connected Mailboxes ({senders.length})
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isAddingCustom ? 'secondary' : 'primary'}
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {isAddingCustom ? 'Cancel' : 'Add Mailbox'}
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : senders.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-6 text-center">
            <p className="text-xs text-slate-500 mb-3">
              No mailboxes configured yet. Add your email sender to begin outreach.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsAddingCustom(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Mailbox
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {senders.map((sender: Sender) => (
              <div
                key={sender.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#6D4AFF] flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {sender.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {sender.email} &bull; {sender.hourlyLimit} emails/hr limit
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(sender.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remove mailbox"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Custom SMTP Form */}
        {isAddingCustom && (
          <form
            onSubmit={handleCustomSubmit}
            className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3 pt-3"
          >
            <h5 className="text-xs font-semibold text-slate-800">
              Add Custom SMTP Mailbox
            </h5>

            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Sender name"
                placeholder="e.g. Outreach Team"
                value={customForm.name}
                onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                required
              />
              <Input
                label="Sender email"
                type="email"
                placeholder="outreach@company.com"
                value={customForm.email}
                onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="SMTP host"
                placeholder="smtp.ethereal.email"
                value={customForm.smtpHost}
                onChange={(e) => setCustomForm({ ...customForm, smtpHost: e.target.value })}
                required
              />
              <Input
                label="SMTP port"
                type="number"
                placeholder="587"
                value={customForm.smtpPort}
                onChange={(e) =>
                  setCustomForm({ ...customForm, smtpPort: parseInt(e.target.value, 10) || 587 })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="SMTP username"
                placeholder="Username"
                value={customForm.smtpUser}
                onChange={(e) => setCustomForm({ ...customForm, smtpUser: e.target.value })}
                required
              />
              <Input
                label="SMTP password"
                type="password"
                placeholder="••••••••"
                value={customForm.smtpPassword}
                onChange={(e) => setCustomForm({ ...customForm, smtpPassword: e.target.value })}
                required
              />
            </div>

            <Input
              label="Hourly limit"
              type="number"
              min={1}
              value={customForm.hourlyLimit}
              onChange={(e) =>
                setCustomForm({ ...customForm, hourlyLimit: parseInt(e.target.value, 10) || 200 })
              }
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setIsAddingCustom(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                isLoading={createMutation.isPending}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Save Mailbox
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
