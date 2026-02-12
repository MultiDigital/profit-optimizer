'use client';

import { useSettings } from '@/hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Skeleton,
} from '@/components/ui';
import { SettingsInput } from '@/lib/optimizer/types';

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  const handleChange = (field: keyof SettingsInput, value: string) => {
    if (!settings) return;
    const numValue = parseFloat(value) || 0;
    updateSettings({
      senior_rate: settings.senior_rate,
      middle_up_rate: settings.middle_up_rate,
      middle_rate: settings.middle_rate,
      junior_rate: settings.junior_rate,
      [field]: numValue,
    });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Daily Rates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : settings ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Senior Rate (EUR/day)</Label>
                  <Input
                    type="number"
                    value={settings.senior_rate}
                    onChange={(e) => handleChange('senior_rate', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Daily rate for senior team members
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Middle Up Rate (EUR/day)</Label>
                  <Input
                    type="number"
                    value={settings.middle_up_rate}
                    onChange={(e) => handleChange('middle_up_rate', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Daily rate for middle up team members
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Middle Rate (EUR/day)</Label>
                  <Input
                    type="number"
                    value={settings.middle_rate}
                    onChange={(e) => handleChange('middle_rate', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Daily rate for middle team members
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Junior Rate (EUR/day)</Label>
                  <Input
                    type="number"
                    value={settings.junior_rate}
                    onChange={(e) => handleChange('junior_rate', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Daily rate for junior team members
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load settings</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
