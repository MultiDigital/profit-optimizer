'use client';

import { Input, Label } from '@/components/ui';
import { Settings, SettingsInput } from '@/lib/optimizer/types';

interface RateSettingsProps {
  settings: Settings | null;
  onUpdate: (input: SettingsInput) => Promise<void>;
}

export function RateSettings({ settings, onUpdate }: RateSettingsProps) {
  if (!settings) return null;

  const handleChange = (field: keyof SettingsInput, value: string) => {
    const numValue = parseFloat(value) || 0;
    onUpdate({
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
    <div className="grid grid-cols-5 gap-3 mb-4">
      <div className="space-y-1">
        <Label>Senior (€/day)</Label>
        <Input
          type="number"
          value={settings.senior_rate}
          onChange={(e) => handleChange('senior_rate', e.target.value)}
          min={0}
        />
      </div>
      <div className="space-y-1">
        <Label>Middle Up (€/day)</Label>
        <Input
          type="number"
          value={settings.middle_up_rate}
          onChange={(e) => handleChange('middle_up_rate', e.target.value)}
          min={0}
        />
      </div>
      <div className="space-y-1">
        <Label>Middle (€/day)</Label>
        <Input
          type="number"
          value={settings.middle_rate}
          onChange={(e) => handleChange('middle_rate', e.target.value)}
          min={0}
        />
      </div>
      <div className="space-y-1">
        <Label>Junior (€/day)</Label>
        <Input
          type="number"
          value={settings.junior_rate}
          onChange={(e) => handleChange('junior_rate', e.target.value)}
          min={0}
        />
      </div>
      <div className="space-y-1">
        <Label>Stage (€/day)</Label>
        <Input
          type="number"
          value={settings.stage_rate}
          onChange={(e) => handleChange('stage_rate', e.target.value)}
          min={0}
        />
      </div>
    </div>
  );
}
