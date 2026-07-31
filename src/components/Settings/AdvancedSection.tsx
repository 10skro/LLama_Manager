import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings2, ChevronDown, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useGithubTokenState } from '@/hooks/Settings/useGithubTokenState';

/**
 * Advanced section — collapsible GitHub token management.
 */
export function AdvancedSection() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { token, setToken, hasToken, isSaving, showPlain, setShowPlain, handleSave, handleClear } =
    useGithubTokenState();

  return (
    <Card className="border-yellow/20 bg-card/50">
      <CardHeader className="cursor-pointer" onClick={() => setAdvancedOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Advanced
            <Badge variant="outline" className="text-[10px] font-normal">
              Power Users
            </Badge>
          </span>
          <motion.div
            animate={{ rotate: advancedOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </CardTitle>
        <CardDescription>
          Advanced configuration for power users. API tokens and rate limiting options.
        </CardDescription>
      </CardHeader>
      <AnimatePresence>
        {advancedOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>GitHub API</Label>
                <p className="text-xs text-muted-foreground">
                  Optional: Add a personal access token to increase the GitHub API rate limit from
                  60 to 5000 requests per hour.
                </p>
              </div>

              <div className="space-y-2">
                <Label>GitHub Personal Access Token</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPlain ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={hasToken ? 'Token is configured (edit to update)' : 'ghp_...'}
                      className="bg-background/50 font-mono text-sm pr-10 [-webkit-text-security-disc:none] [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      style={{ WebkitAppearance: 'none' } as CSSProperties}
                    />
                    {(token.length > 0 || hasToken) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPlain((v) => !v)}
                      >
                        {showPlain ? (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>
                  {hasToken && token.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleClear}>
                      Clear
                    </Button>
                  )}
                  {token.length > 0 && (
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Your token is stored locally and only used for GitHub API requests. Create a token
                  at{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    github.com/settings/tokens
                  </a>
                  . No scopes are required.
                </p>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
