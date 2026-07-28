import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { fetchReleaseChangelog } from '@/services/github';

interface ChangelogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagName?: string;
  buildNumber: string;
  /** If provided, skip network fetch and use this body directly. */
  body?: string | null;
}

export function ChangelogModal({ open, onOpenChange, tagName, buildNumber, body }: ChangelogModalProps) {
  const [changelog, setChangelog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    // If body is provided directly, use it immediately (no network fetch)
    if (body !== undefined) {
      setChangelog(body);
      setLoading(false);
      setError(null);
      return;
    }

    // Otherwise, fetch from GitHub API using tagName
    if (!tagName) {
      setChangelog(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setChangelog(null);

    (async () => {
      try {
        const result = await fetchReleaseChangelog(tagName);
        if (!cancelled) {
          setChangelog(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch changelog');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tagName, body]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Changelog - {buildNumber}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Loading changelog...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : changelog != null ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{changelog}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No changelog available for this release.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
