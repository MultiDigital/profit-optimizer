'use client';

import { useServices, useSettings } from '@/hooks';
import { ServicesCard } from '@/components/services';

export default function ServicesPage() {
  const { settings } = useSettings();
  const { services, loading, addService, updateService, deleteService } = useServices();

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <ServicesCard
          services={services}
          settings={settings}
          loading={loading}
          onAddService={addService}
          onUpdateService={updateService}
          onDeleteService={deleteService}
        />
      </div>
    </div>
  );
}
