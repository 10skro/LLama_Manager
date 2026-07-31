import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { AppSettings } from '@/types';
import { AVAILABLE_THEMES } from '@/themes';
import { AVAILABLE_FONTS } from '@/fonts';
import { useSettingsPersistence } from '@/hooks/Settings/useSettingsPersistence';

interface AppearanceSectionProps {
  settings: AppSettings | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
}

/**
 * Appearance section — theme and font selection.
 */
export function AppearanceSection({
  settings,
  updateSetting,
  activeTheme,
  setActiveTheme,
}: AppearanceSectionProps) {
  const { persistSetting } = useSettingsPersistence(settings, updateSetting);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </CardTitle>
        <CardDescription>Customize the look and feel of the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme selector */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2 flex-wrap">
            {AVAILABLE_THEMES.map((theme) => {
              const isActive = activeTheme === theme.id;
              return (
                <Button
                  key={theme.id}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={
                    isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''
                  }
                  onClick={() => {
                    persistSetting('theme', theme.id, {
                      title: 'Theme changed',
                      description: `Applied ${theme.name}`,
                    });
                    setActiveTheme(theme.id);
                  }}
                >
                  {isActive && <Check className="h-3.5 w-3.5 mr-1.5" />}
                  {theme.name}
                </Button>
              );
            })}
          </div>
        </div>

        <Separator className="border-border/50" />

        {/* Font selector */}
        <div className="space-y-2">
          <Label>Font</Label>
          <div className="flex gap-2 flex-wrap">
            {AVAILABLE_FONTS.map((font) => {
              const isActive = settings?.font_family === font.cssFamily;
              return (
                <Button
                  key={font.id}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={
                    isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''
                  }
                  style={{ fontFamily: font.cssFamily }}
                  onClick={() =>
                    persistSetting('font_family', font.cssFamily, {
                      title: 'Font changed',
                      description: `Applied ${font.name}`,
                    })
                  }
                >
                  {isActive && <Check className="h-3.5 w-3.5 mr-1.5" />}
                  {font.name}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
