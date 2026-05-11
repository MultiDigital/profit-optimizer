'use client';

import { ScenarioMemberEvent } from '@/lib/optimizer/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HREventList } from '@/components/hr/HREventList';
import { Plus } from 'lucide-react';

interface ScenarioOverlayPanelProps {
  scenarioName: string;
  events: ScenarioMemberEvent[]; // scoped to this one employee
  onAdd: () => void;
  onEdit: (event: ScenarioMemberEvent) => void;
  onDelete: (eventId: string) => void;
}

export function ScenarioOverlayPanel({
  scenarioName,
  events,
  onAdd,
  onEdit,
  onDelete,
}: ScenarioOverlayPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Scenario overlay
            <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
              {scenarioName}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Change (scenario)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <HREventList events={events} onEdit={(e) => onEdit(e as ScenarioMemberEvent)} onDelete={onDelete} />
      </CardContent>
    </Card>
  );
}
