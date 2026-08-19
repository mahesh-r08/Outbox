import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, Trash2 } from 'lucide-react';
import { parseEmailList, CsvParseResult } from '../../lib/csvParser.js';
import { Button } from './Button.js';
import { cn } from '../../lib/utils.js';

export interface FileUploaderProps {
  onParsed: (result: CsvParseResult) => void;
  result?: CsvParseResult | null;
  onClear?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onParsed,
  result,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = (content: string, name: string) => {
    setFileName(name);
    const parsed = parseEmailList(content);
    onParsed(parsed);
  };

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      processText(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualSubmit = () => {
    processText(manualText, 'manual-input.txt');
  };

  const handleClear = () => {
    setFileName(null);
    setManualText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear?.();
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-slate-700">
          Recipients
        </label>
        <button
          type="button"
          onClick={() => setIsManualInput(!isManualInput)}
          className="text-xs text-[#6D4AFF] hover:underline font-medium cursor-pointer"
        >
          {isManualInput ? 'Upload file instead' : 'Paste text / emails'}
        </button>
      </div>

      {!result || result.validCount === 0 ? (
        isManualInput ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              placeholder="Paste emails separated by commas or lines...&#10;john@example.com&#10;sarah@company.io"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-300 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF] font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleManualSubmit}
              disabled={!manualText.trim()}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            >
              Parse emails
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group relative flex flex-col items-center justify-center p-5 border border-dashed rounded-lg cursor-pointer transition-colors text-center bg-slate-50/50 hover:bg-slate-50',
              isDragging
                ? 'border-[#6D4AFF] bg-purple-50/30'
                : 'border-slate-300 hover:border-slate-400'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <Upload className="w-5 h-5 text-slate-400 mb-1.5" />

            <p className="text-xs font-medium text-slate-700">
              Drop CSV here or <span className="text-[#6D4AFF]">browse</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              CSV / TXT files supported
            </p>
          </div>
        )
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2.5">
          {/* File summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                <strong>{result.validCount}</strong> email addresses detected
                {fileName && <span className="text-slate-400 font-normal ml-1.5">({fileName})</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>

          {/* Validation indicators if duplicates/invalid exist */}
          {(result.duplicateCount > 0 || result.invalidCount > 0) && (
            <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 border-t border-slate-200">
              {result.duplicateCount > 0 && (
                <span>{result.duplicateCount} duplicates removed</span>
              )}
              {result.invalidCount > 0 && (
                <span className="text-rose-600">{result.invalidCount} invalid ignored</span>
              )}
            </div>
          )}

          {/* Preview list */}
          <div className="max-h-20 overflow-y-auto space-y-1 bg-white rounded border border-slate-200 p-2 text-xs font-mono text-slate-600">
            {result.preview.slice(0, 5).map((email, idx) => (
              <div key={idx} className="truncate">
                {email}
              </div>
            ))}
            {result.validCount > 5 && (
              <div className="text-[10px] text-slate-400 font-sans">
                + {result.validCount - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
