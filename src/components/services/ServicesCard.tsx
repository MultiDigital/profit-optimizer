'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  Skeleton,
} from '@/components/ui';
import { ServiceList } from './ServiceList';
import { Service, ServiceInput, Settings, DEFAULT_SERVICE } from '@/lib/optimizer/types';

interface ServicesCardProps {
  services: Service[];
  settings: Settings | null;
  loading?: boolean;
  onAddService: (input: ServiceInput) => Promise<void>;
  onUpdateService: (id: string, input: Partial<ServiceInput>) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
}

export function ServicesCard({
  services,
  settings,
  loading,
  onAddService,
  onUpdateService,
  onDeleteService,
}: ServicesCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<ServiceInput>(DEFAULT_SERVICE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData(DEFAULT_SERVICE);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleSave = async () => {
    setError(null);

    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }

    const totalDays =
      formData.senior_days + formData.middle_days + formData.junior_days;
    if (totalDays === 0) {
      setError('Service must require at least 1 day of work');
      return;
    }

    setSaving(true);
    try {
      await onAddService(formData);
      setIsOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>📦</span> Services / Products
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm">+ Add Service</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Service</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {error && (
                  <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input
                    value={formData.name}
                    placeholder="e.g., Executive Search"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price (EUR)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Senior Days</Label>
                    <Input
                      type="number"
                      value={formData.senior_days}
                      onChange={(e) =>
                        setFormData({ ...formData, senior_days: parseFloat(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Days</Label>
                    <Input
                      type="number"
                      value={formData.middle_days}
                      onChange={(e) =>
                        setFormData({ ...formData, middle_days: parseFloat(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Junior Days</Label>
                    <Input
                      type="number"
                      value={formData.junior_days}
                      onChange={(e) =>
                        setFormData({ ...formData, junior_days: parseFloat(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </div>
                </div>

              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Service'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : (
          <ServiceList
            services={services}
            settings={settings}
            onUpdate={onUpdateService}
            onDelete={onDeleteService}
          />
        )}
      </CardContent>
    </Card>
  );
}
