import type { IncidentNote } from '@/lib/types';
import { formatTimestamp } from './utils';

interface AnalystNotesProps {
  notes: IncidentNote[];
  notesLoading: boolean;
  noteAuthor: string;
  noteContent: string;
  submittingNote: boolean;
  onNoteAuthorChange: (value: string) => void;
  onNoteContentChange: (value: string) => void;
  onSubmitNote: () => void;
}

export default function AnalystNotes({
  notes,
  notesLoading,
  noteAuthor,
  noteContent,
  submittingNote,
  onNoteAuthorChange,
  onNoteContentChange,
  onSubmitNote,
}: AnalystNotesProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-300">
        Analyst Notes ({notes.length})
      </h2>

      {notesLoading ? (
        <div className="mb-4 text-sm font-mono text-cyan-700 animate-pulse dark:text-cyan-400">
          Loading notes...
        </div>
      ) : notes.length > 0 ? (
        <div className="mb-4 space-y-3">
          {notes.map((note) => (
            <div
              key={note.note_id}
              className="rounded-r-lg border border-slate-200 border-l-4 border-l-cyan-700 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-mono font-medium text-cyan-700 dark:text-cyan-400">
                  {note.author}
                </span>
                <span className="text-xs font-mono text-slate-400 dark:text-gray-600">
                  {formatTimestamp(note.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-gray-300">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm font-mono text-slate-400 dark:text-gray-600">
          No notes yet
        </p>
      )}

      <div className="border-t border-slate-200 pt-4 dark:border-gray-800">
        <p className="mb-3 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-500">
          Add Note
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Author"
            value={noteAuthor}
            onChange={(e) => onNoteAuthorChange(e.target.value)}
            className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-mono text-slate-800 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <textarea
            placeholder="Write your note..."
            value={noteContent}
            onChange={(e) => onNoteContentChange(e.target.value)}
            rows={3}
            className="w-full resize-none rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <button
            onClick={onSubmitNote}
            disabled={submittingNote || !noteAuthor.trim() || !noteContent.trim()}
            className="rounded border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan-700 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-cyan-400"
          >
            {submittingNote ? 'Submitting...' : 'Submit Note'}
          </button>
        </div>
      </div>
    </section>
  );
}
