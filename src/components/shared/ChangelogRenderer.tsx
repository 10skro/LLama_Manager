import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface ChangelogRendererProps {
  body: string | null;
}

/**
 * Unified changelog renderer using ReactMarkdown + Tailwind typography.
 * Used by UpdateModal, ChangelogModal, and post-install changelog display.
 */
export function ChangelogRenderer({ body }: ChangelogRendererProps) {
  if (!body) {
    return <p className="text-sm text-muted-foreground">No changelog available.</p>;
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
