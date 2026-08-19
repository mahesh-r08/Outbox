import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal.js';
import { Input } from '../ui/Input.js';
import { Textarea } from '../ui/Textarea.js';
import { Select } from '../ui/Select.js';
import { Button } from '../ui/Button.js';
import { FileUploader } from '../ui/FileUploader.js';
import { scheduleEmails } from '../../api/emailApi.js';
import { getSenders, createSender } from '../../api/senderApi.js';
import type { Sender } from '../../types/index.js';
import type { CsvParseResult } from '../../lib/csvParser.js';

// Generate 30-minute dropdown time options
const timeSlotOptions = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  const paddedHours = String(hours).padStart(2, '0');
  const value = `${paddedHours}:${minutes}`;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const label = `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`;
  return { value, label };
});

const todayDateString = new Date().toISOString().split('T')[0];

const composeSchema = z.object({
  senderId: z.string().min(1, 'Please select a sender mailbox'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  startTimeOption: z.string(),
  customDate: z.string().optional(),
  customTimeSlot: z.string().optional(),
  delaySeconds: z.coerce.number().min(0).default(2),
  hourlyLimit: z.coerce.number().min(1).default(200),
});

type ComposeFormData = z.infer<typeof composeSchema>;

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [parsedLeads, setParsedLeads] = useState<CsvParseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingSender, setIsCreatingSender] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ComposeFormData>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      subject: '',
      body: '',
      startTimeOption: 'now',
      customDate: todayDateString,
      customTimeSlot: '09:00',
      delaySeconds: 2,
      hourlyLimit: 200,
    },
  });

  const startTimeOption = watch('startTimeOption');
  const selectedSenderId = watch('senderId');

  useEffect(() => {
    if (isOpen) {
      loadSenders();
    }
  }, [isOpen]);

  const loadSenders = async () => {
    try {
      const data = await getSenders();
      setSenders(data);
      if (data.length > 0 && !selectedSenderId) {
        setValue('senderId', data[0].id);
      }
    } catch (err: any) {
      toast.error('Failed to load senders: ' + (err.customMessage || err.message));
    }
  };

  const handleQuickAddMailbox = async () => {
    try {
      setIsCreatingSender(true);
      const newSender = await createSender({
        name: 'Default Mailbox',
        autoProvisionEthereal: true,
        hourlyLimit: 200,
      });
      toast.success(`Mailbox connected: ${newSender.email}`);
      await loadSenders();
      setValue('senderId', newSender.id);
    } catch (err: any) {
      toast.error('Failed to connect mailbox: ' + (err.customMessage || err.message));
    } finally {
      setIsCreatingSender(false);
    }
  };

  const onSubmit = async (data: ComposeFormData) => {
    if (!parsedLeads || parsedLeads.validEmails.length === 0) {
      toast.error('Please add at least one valid recipient lead');
      return;
    }

    let computedStartTime = new Date();
    if (data.startTimeOption === 'in_1_min') {
      computedStartTime = new Date(Date.now() + 60 * 1000);
    } else if (data.startTimeOption === 'in_5_mins') {
      computedStartTime = new Date(Date.now() + 5 * 60 * 1000);
    } else if (data.startTimeOption === 'in_15_mins') {
      computedStartTime = new Date(Date.now() + 15 * 60 * 1000);
    } else if (data.startTimeOption === 'in_30_mins') {
      computedStartTime = new Date(Date.now() + 30 * 60 * 1000);
    } else if (data.startTimeOption === 'in_1_hour') {
      computedStartTime = new Date(Date.now() + 60 * 60 * 1000);
    } else if (data.startTimeOption === 'tomorrow_9am') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      computedStartTime = tomorrow;
    } else if (data.startTimeOption === 'tomorrow_2pm') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      computedStartTime = tomorrow;
    } else if (data.startTimeOption === 'custom') {
      const datePart = data.customDate || todayDateString;
      const timePart = data.customTimeSlot || '09:00';
      computedStartTime = new Date(`${datePart}T${timePart}:00`);
      if (isNaN(computedStartTime.getTime())) {
        computedStartTime = new Date();
      }
    }

    try {
      setIsSubmitting(true);
      const result = await scheduleEmails({
        senderId: data.senderId,
        subject: data.subject,
        body: data.body,
        recipients: parsedLeads.validEmails,
        startTime: computedStartTime.toISOString(),
        delayMs: data.delaySeconds * 1000,
        hourlyLimit: data.hourlyLimit,
      });

      toast.success(`Scheduled ${result.scheduledCount} emails successfully`);
      reset();
      setParsedLeads(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.customMessage || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  const senderOptions = senders.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.email})`,
  }));

  const leadCount = parsedLeads?.validCount || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Sender Selection */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-700">
              Sender mailbox
            </label>
            {senders.length === 0 && (
              <button
                type="button"
                onClick={handleQuickAddMailbox}
                disabled={isCreatingSender}
                className="text-xs text-[#6D4AFF] hover:underline font-medium cursor-pointer"
              >
                {isCreatingSender ? 'Connecting...' : '+ Add Mailbox'}
              </button>
            )}
          </div>
          {senders.length > 0 ? (
            <Select
              options={senderOptions}
              {...register('senderId')}
              error={errors.senderId?.message}
            />
          ) : (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
              <span className="text-xs text-slate-600">No mailboxes connected yet.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleQuickAddMailbox}
                isLoading={isCreatingSender}
              >
                Add Mailbox
              </Button>
            </div>
          )}
        </div>

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Subject line"
          {...register('subject')}
          error={errors.subject?.message}
        />

        {/* Body */}
        <Textarea
          label="Email body"
          placeholder="Write your email content..."
          rows={5}
          {...register('body')}
          error={errors.body?.message}
        />

        {/* Recipients File Uploader */}
        <FileUploader
          onParsed={(res) => setParsedLeads(res)}
          result={parsedLeads}
          onClear={() => setParsedLeads(null)}
        />

        {/* Schedule settings */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-800 mb-2">
            Schedule
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Start Time Option Dropdown */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                When to send
              </label>
              <select
                className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
                {...register('startTimeOption')}
              >
                <option value="now">Send Immediately</option>
                <option value="in_1_min">In 1 minute</option>
                <option value="in_5_mins">In 5 minutes</option>
                <option value="in_15_mins">In 15 minutes</option>
                <option value="in_30_mins">In 30 minutes</option>
                <option value="in_1_hour">In 1 hour</option>
                <option value="tomorrow_9am">Tomorrow at 09:00 AM</option>
                <option value="tomorrow_2pm">Tomorrow at 02:00 PM</option>
                <option value="custom">Select specific Date & Time</option>
              </select>
            </div>

            {/* Delay */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Delay between emails
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={300}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
                  {...register('delaySeconds')}
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">sec</span>
              </div>
            </div>

            {/* Hourly Limit */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Hourly limit
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
                  {...register('hourlyLimit')}
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">/hr</span>
              </div>
            </div>
          </div>

          {/* Custom Date & Time Selectors */}
          {startTimeOption === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-2.5 border-t border-dashed border-slate-200">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Select Date
                </label>
                <input
                  type="date"
                  min={todayDateString}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
                  {...register('customDate')}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Select Time Dropdown
                </label>
                <select
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
                  {...register('customTimeSlot')}
                >
                  {timeSlotOptions.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={!parsedLeads || parsedLeads.validCount === 0 || senders.length === 0}
          >
            Schedule Email{leadCount > 0 ? ` (${leadCount})` : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
