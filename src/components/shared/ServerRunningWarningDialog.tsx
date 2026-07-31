import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ServerRunningWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Shared warning dialog shown when servers are running and need to be
 * stopped before an update can be installed. Used by UpdateModal,
 * Header, and SettingsPage to avoid duplicating the same UI.
 */
export function ServerRunningWarningDialog({
  open,
  onOpenChange,
  onConfirm,
}: ServerRunningWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onCloseAutoFocus={() => {}}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Servers Running
          </DialogTitle>
          <DialogDescription>
            Servers are currently active and will be stopped before installing the update. Do you
            want to continue?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
