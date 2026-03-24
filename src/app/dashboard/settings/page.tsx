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
      stage_rate: settings.stage_rate,
      festivita_nazionali: settings.festivita_nazionali,
      yearly_workable_days: settings.yearly_workable_days,
      ferie: settings.ferie,
      malattia: settings.malattia,
      formazione: settings.formazione,
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : settings ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <div className="space-y-2">
                  <Label>Stage Rate (EUR/day)</Label>
                  <Input
                    type="number"
                    value={settings.stage_rate}
                    onChange={(e) => handleChange('stage_rate', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Daily rate for stage/intern members
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load settings</p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Calendar Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : settings ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Yearly Workable Days</Label>
                  <Input
                    type="number"
                    value={settings.yearly_workable_days}
                    onChange={(e) => handleChange('yearly_workable_days', e.target.value)}
                    min={1}
                    max={366}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total working days in a year
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Festivita Nazionali</Label>
                  <Input
                    type="number"
                    value={settings.festivita_nazionali}
                    onChange={(e) => handleChange('festivita_nazionali', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    National holidays per year
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Ferie (days)</Label>
                  <Input
                    type="number"
                    value={settings.ferie}
                    onChange={(e) => handleChange('ferie', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vacation days per year
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Malattia (days)</Label>
                  <Input
                    type="number"
                    value={settings.malattia}
                    onChange={(e) => handleChange('malattia', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sick days per year
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Formazione (days)</Label>
                  <Input
                    type="number"
                    value={settings.formazione}
                    onChange={(e) => handleChange('formazione', e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Training days per year
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
