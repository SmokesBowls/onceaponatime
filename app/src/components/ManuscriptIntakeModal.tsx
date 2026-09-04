import React, { useState } from 'react';
import { BookOpen, FileUp, X } from 'lucide-react';

export interface ManuscriptIntakeSubmission {
  projectTitle: string;
  sourceLabel: string;
  pastedText: string;
}

interface ManuscriptIntakeModalProps {
  onCancel: () => void;
  onSubmit: (submission: ManuscriptIntakeSubmission) => void;
}

/**
 * Author Manuscript Intake Baseline.
 *
 * The only front door for an author's own prose to enter a project. Pasted
 * text is stored exactly as entered -- see src/lib/manuscriptIntake.ts. This
 * form performs no analysis of its own: it collects three plain strings and
 * hands them to the caller unmodified.
 */
export const ManuscriptIntakeModal: React.FC<ManuscriptIntakeModalProps> = ({
  onCancel,
  onSubmit,
}) => {
  const [projectTitle, setProjectTitle] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [pastedText, setPastedText] = useState('');

  const hasPastedText = pastedText.length > 0;

  const handleSubmit = () => {
    onSubmit({ projectTitle, sourceLabel, pastedText });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[#1A1A1A]/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#FDFCF8] border border-[#1A1A1A] rounded shadow-xl my-8">
        <div className="flex items-start justify-between border-b border-[#1A1A1A]/20 p-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-sans text-[#736B63] block mb-1 font-bold">
              New Project
            </span>
            <h2 className="text-xl sm:text-2xl font-serif italic text-[#1A1A1A]">
              Author Manuscript Intake
            </h2>
            <p className="text-xs text-[#5A554E] font-serif italic mt-2 max-w-lg">
              Paste an existing chapter or manuscript, or leave the text empty to start a
              blank project. Pasted text is stored exactly as entered -- it is not
              rewritten, summarized, or used to invent characters, places, or story state.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-[#E5E2D9] text-[#736B63] hover:text-[#1A1A1A] transition"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
              Project Title
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="e.g. My Novel"
              className="w-full bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded px-3 py-2 text-sm text-[#1A1A1A] font-serif focus:border-[#1A1A1A] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
              Source / Chapter Title or Label
            </label>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="e.g. Chapter One: The Departure"
              className="w-full bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded px-3 py-2 text-sm text-[#1A1A1A] font-serif focus:border-[#1A1A1A] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
                Paste Manuscript Text (Optional)
              </label>
              <span className="text-[10px] font-sans text-[#8C827A]">
                {pastedText.length.toLocaleString()} characters
              </span>
            </div>
            <textarea
              rows={14}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your existing chapter or manuscript text here..."
              className="w-full bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded p-3 text-sm text-[#1A1A1A] font-serif leading-relaxed focus:border-[#1A1A1A] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#1A1A1A]/20 p-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] text-xs font-sans uppercase tracking-wider font-semibold text-[#1A1A1A] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#1A1A1A] hover:bg-[#333333] text-xs font-sans uppercase tracking-widest font-bold text-[#FDFCF8] transition shadow-md"
          >
            {hasPastedText ? (
              <>
                <FileUp className="h-3.5 w-3.5" />
                <span>Import Manuscript</span>
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5" />
                <span>Create Blank Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
