import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveGithubToken, hasGithubToken, deleteGithubToken } from '@/services/github-token';

/**
 * GitHub token management hook (FR-003, TD-003).
 * Encapsulates all token-related state and handlers previously inline in SettingsPage.
 */
export function useGithubTokenState() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPlain, setShowPlain] = useState(false);

  // Check if token exists on mount
  useEffect(() => {
    hasGithubToken()
      .then(setHasToken)
      .catch(() => {});
  }, []);

  /** Save or update the GitHub token */
  const handleSave = async () => {
    if (!token.trim()) return;
    setIsSaving(true);
    try {
      await saveGithubToken(token.trim());
      setHasToken(true);
      setToken('');
      toast({ title: 'Token saved', description: 'GitHub token saved securely.' });
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  /** Remove the stored GitHub token */
  const handleClear = async () => {
    try {
      await deleteGithubToken();
      setToken('');
      setHasToken(false);
      toast({ title: 'Token removed', description: 'GitHub token has been cleared.' });
    } catch (err) {
      toast({ title: 'Clear failed', description: String(err), variant: 'destructive' });
    }
  };

  return {
    token,
    setToken,
    hasToken,
    isSaving,
    showPlain,
    setShowPlain,
    handleSave,
    handleClear,
  };
}
