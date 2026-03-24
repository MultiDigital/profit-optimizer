'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSettings, useMembers, useServices, useScenarios, useOptimizer, useCostCenters } from '@/hooks';
import { ResultsCard } from '@/components/results';
import { ScenarioDialog } from '@/components/scenarios';
import { ScenarioMembersDataTable } from '@/components/scenarios/scenario-members-data-table';
import { createColumns as createMemberColumns } from '@/components/scenarios/scenario-members-columns';
import { ScenarioServicesDataTable } from '@/components/scenarios/scenario-services-data-table';
import { createColumns as createServiceColumns } from '@/components/scenarios/scenario-services-columns';
import {
  Button,
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  ScenarioWithData,
  ScenarioMemberData,
  ScenarioServiceData,
  SENIORITY_LABELS,
  SENIORITY_LEVELS,
  SeniorityLevel,
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABELS,
  MemberCategory,
  CapacitySettings,
  DEFAULT_SETTINGS,
} from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

export default function ScenarioViewPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;

  const { settings } = useSettings();
  const { members: allMembers } = useMembers();
  const { services: allServices } = useServices();
  const { costCenters } = useCostCenters();
  const {
    updateScenario,
    deleteScenario,
    addMemberToScenario,
    removeMemberFromScenario,
    addServiceToScenario,
    removeServiceFromScenario,
    updateScenarioMember,
    updateScenarioService,
    fetchScenarioWithData,
    fetchScenarioSourceIds,
  } = useScenarios();

  const [scenario, setScenario] = useState<ScenarioWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);

  // Member editing state
  const [editingMember, setEditingMember] = useState<ScenarioMemberData | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    category: 'dipendente' as MemberCategory,
    seniority: 'middle' as SeniorityLevel | null,
    salary: 50000,
    chargeable_days: null as number | null,
    ft_percentage: 100,
    capacity_percentage: 100,
    cost_percentage: 100,
  });
  const [savingMember, setSavingMember] = useState(false);

  // Service editing state
  const [editingService, setEditingService] = useState<ScenarioServiceData | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    senior_days: 0,
    middle_up_days: 0,
    middle_days: 0,
    junior_days: 0,
    stage_days: 0,
    price: 0,
    max_year: null as number | null,
  });
  const [savingService, setSavingService] = useState(false);

  // Delete confirmation state
  const [deletingMember, setDeletingMember] = useState<ScenarioMemberData | null>(null);
  const [deletingService, setDeletingService] = useState<ScenarioServiceData | null>(null);

  // Load scenario data
  const loadScenario = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScenarioWithData(scenarioId);
      setScenario(data);
    } finally {
      setLoading(false);
    }
  }, [scenarioId, fetchScenarioWithData]);

  useEffect(() => {
    loadScenario();
  }, [loadScenario]);

  // Populate member form when editing
  useEffect(() => {
    if (editingMember) {
      setMemberFormData({
        category: editingMember.category,
        seniority: editingMember.seniority,
        salary: editingMember.salary,
        chargeable_days: editingMember.chargeable_days ?? null,
        ft_percentage: editingMember.ft_percentage ?? 100,
        capacity_percentage: editingMember.capacity_percentage ?? 100,
        cost_percentage: editingMember.cost_percentage ?? 100,
      });
    }
  }, [editingMember]);

  // Handle member edit save
  const handleMemberSave = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      await updateScenarioMember(editingMember.id, memberFormData);
      await loadScenario();
      setEditingMember(null);
    } finally {
      setSavingMember(false);
    }
  };

  // Handle member delete
  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    await removeMemberFromScenario(deletingMember.id);
    await loadScenario();
    setDeletingMember(null);
  };

  // Member columns for data table
  const capacitySettings: CapacitySettings = {
    yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
    festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
    ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
    malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
    formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
  };
  const memberColumns = useMemo(
    () => createMemberColumns({ onEdit: setEditingMember, onDelete: setDeletingMember, capacitySettings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capacitySettings.yearly_workable_days, capacitySettings.festivita_nazionali, capacitySettings.ferie, capacitySettings.malattia, capacitySettings.formazione]
  );

  // Populate service form when editing
  useEffect(() => {
    if (editingService) {
      setServiceFormData({
        senior_days: editingService.senior_days,
        middle_up_days: editingService.middle_up_days,
        middle_days: editingService.middle_days,
        junior_days: editingService.junior_days,
        stage_days: editingService.stage_days,
        price: editingService.price,
        max_year: editingService.max_year,
      });
    }
  }, [editingService]);

  // Handle service edit save
  const handleServiceSave = async () => {
    if (!editingService) return;
    setSavingService(true);
    try {
      await updateScenarioService(editingService.id, serviceFormData);
      await loadScenario();
      setEditingService(null);
    } finally {
      setSavingService(false);
    }
  };

  // Handle service delete
  const handleDeleteService = async () => {
    if (!deletingService) return;
    await removeServiceFromScenario(deletingService.id);
    await loadScenario();
    setDeletingService(null);
  };

  // Service columns for data table
  const serviceColumns = useMemo(
    () => createServiceColumns({ onEdit: setEditingService, onDelete: setDeletingService }),
    []
  );

  // Run optimizer on scenario's members/services
  // Convert ScenarioMemberData/ScenarioServiceData to the format expected by optimizer
  // Memoized to prevent infinite recalculation loops
  const optimizerMembers = useMemo(() =>
    scenario?.members.map((m) => ({
      ...m,
      user_id: '', // Not needed for optimization
    })) ?? []
  , [scenario?.members]);

  const optimizerServices = useMemo(() =>
    scenario?.services.map((s) => ({
      ...s,
      user_id: '', // Not needed for optimization
    })) ?? []
  , [scenario?.services]);

  const { result, isCalculating } = useOptimizer(
    optimizerMembers,
    optimizerServices,
    settings
  );

  // Handle edit click
  const handleEditClick = async () => {
    const links = await fetchScenarioSourceIds(scenarioId);
    setEditMemberIds(links.memberIds);
    setEditServiceIds(links.serviceIds);
    setEditDialogOpen(true);
  };

  // Handle edit save (add-only - removal is done via table row actions)
  const handleEditSave = useCallback(async (name: string, memberIdsToAdd: string[], serviceIdsToAdd: string[]) => {
    await updateScenario(scenarioId, { name });

    for (const memberId of memberIdsToAdd) {
      const member = allMembers.find((m) => m.id === memberId);
      if (member) await addMemberToScenario(scenarioId, member);
    }

    for (const serviceId of serviceIdsToAdd) {
      const service = allServices.find((s) => s.id === serviceId);
      if (service) await addServiceToScenario(scenarioId, service);
    }

    await loadScenario();
    setEditDialogOpen(false);
  }, [scenarioId, updateScenario, addMemberToScenario, addServiceToScenario, allMembers, allServices, loadScenario]);

  // Handle delete
  const handleDelete = async () => {
    await deleteScenario(scenarioId);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Scenario not found</h2>
            <p className="text-muted-foreground mb-4">
              This scenario may have been deleted or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{scenario.name}</h1>
                {scenario.cost_center_id && (() => {
                  const cc = costCenters.find((c) => c.id === scenario.cost_center_id);
                  return cc ? (
                    <Badge variant="secondary">{cc.code}</Badge>
                  ) : null;
                })()}
              </div>
              <p className="text-sm text-muted-foreground">
                {scenario.members.length} team member{scenario.members.length !== 1 ? 's' : ''} · {scenario.services.length} service{scenario.services.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleEditClick}>
              Edit Scenario
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{scenario.name}</strong>?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Results first */}
        <ResultsCard result={result} isCalculating={isCalculating} />

        {/* Inputs in tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">
                  Team Members <Badge className="ml-1.5 bg-black/5 text-foreground">{scenario.members.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="services">
                  Services <Badge className="ml-1.5 bg-black/5 text-foreground">{scenario.services.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-4">
                <ScenarioMembersDataTable
                  columns={memberColumns}
                  data={scenario.members}
                />
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <ScenarioServicesDataTable
                  columns={serviceColumns}
                  data={scenario.services}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit Scenario Dialog */}
        <ScenarioDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          scenario={scenario}
          allMembers={allMembers}
          allServices={allServices}
          initialMemberIds={editMemberIds}
          initialServiceIds={editServiceIds}
          onSave={handleEditSave}
          mode="edit"
        />

        {/* Edit Member Sheet */}
        <Sheet open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Edit {editingMember?.first_name} {editingMember?.last_name}</SheetTitle>
              <SheetDescription>Modify team member properties for this scenario</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={memberFormData.category}
                  onValueChange={(value) => {
                    const category = value as MemberCategory;
                    setMemberFormData({
                      ...memberFormData,
                      category,
                      seniority: category === 'segnalatore' ? null : (memberFormData.seniority ?? 'middle'),
                      chargeable_days: category === 'freelance' ? memberFormData.chargeable_days : null,
                      ft_percentage: category === 'dipendente' ? (memberFormData.ft_percentage ?? 100) : 100,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {MEMBER_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {memberFormData.category !== 'segnalatore' && (
                <div className="space-y-2">
                  <Label>Seniority</Label>
                  <Select
                    value={memberFormData.seniority ?? 'middle'}
                    onValueChange={(value) => setMemberFormData({ ...memberFormData, seniority: value as SeniorityLevel })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {SENIORITY_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {SENIORITY_LABELS[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {memberFormData.category === 'dipendente' && (
                <div className="space-y-2">
                  <Label>Full-Time %</Label>
                  <Input
                    type="number"
                    value={memberFormData.ft_percentage ?? 100}
                    onChange={(e) => setMemberFormData({ ...memberFormData, ft_percentage: parseFloat(e.target.value) || 100 })}
                    min={1}
                    max={100}
                  />
                </div>
              )}

              {memberFormData.category === 'freelance' && (
                <div className="space-y-2">
                  <Label>Chargeable Days/Year</Label>
                  <Input
                    type="number"
                    value={memberFormData.chargeable_days ?? ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, chargeable_days: e.target.value ? parseFloat(e.target.value) : null })}
                    min={0}
                    placeholder="Auto (uses yearly workable days)"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Salary (EUR/year)</Label>
                <Input
                  type="number"
                  value={memberFormData.salary}
                  onChange={(e) => setMemberFormData({ ...memberFormData, salary: parseFloat(e.target.value) || 50000 })}
                  min={0}
                  step={1000}
                />
              </div>

              <div className="space-y-2">
                <Label>Capacity %</Label>
                <Input
                  type="number"
                  value={memberFormData.capacity_percentage}
                  onChange={(e) => setMemberFormData({ ...memberFormData, capacity_percentage: parseFloat(e.target.value) || 100 })}
                  min={1}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Affects available days for projects
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cost %</Label>
                <Input
                  type="number"
                  value={memberFormData.cost_percentage}
                  onChange={(e) => setMemberFormData({ ...memberFormData, cost_percentage: parseFloat(e.target.value) || 100 })}
                  min={1}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Affects contribution to fixed costs
                </p>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setEditingMember(null)}>
                Cancel
              </Button>
              <Button onClick={handleMemberSave} disabled={savingMember}>
                {savingMember ? 'Saving...' : 'Save'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Edit Service Sheet */}
        <Sheet open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Edit {editingService?.name}</SheetTitle>
              <SheetDescription>Modify service properties for this scenario</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="space-y-2">
                <Label>Price (EUR)</Label>
                <Input
                  type="number"
                  value={serviceFormData.price}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, price: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Senior Days</Label>
                <Input
                  type="number"
                  value={serviceFormData.senior_days}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, senior_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Middle Up Days</Label>
                <Input
                  type="number"
                  value={serviceFormData.middle_up_days}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, middle_up_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Middle Days</Label>
                <Input
                  type="number"
                  value={serviceFormData.middle_days}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, middle_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Junior Days</Label>
                <Input
                  type="number"
                  value={serviceFormData.junior_days}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, junior_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Stage Days</Label>
                <Input
                  type="number"
                  value={serviceFormData.stage_days}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, stage_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Max/Year</Label>
                <Input
                  type="number"
                  value={serviceFormData.max_year ?? ''}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, max_year: e.target.value ? parseFloat(e.target.value) : null })}
                  min={0}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setEditingService(null)}>
                Cancel
              </Button>
              <Button onClick={handleServiceSave} disabled={savingService}>
                {savingService ? 'Saving...' : 'Save'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Delete Member Confirmation */}
        <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove team member?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{deletingMember?.first_name} {deletingMember?.last_name}</strong> from this scenario?
                This only removes them from the scenario, not from your catalog.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMember}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Service Confirmation */}
        <AlertDialog open={!!deletingService} onOpenChange={(open) => !open && setDeletingService(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove service?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{deletingService?.name}</strong> from this scenario?
                This only removes it from the scenario, not from your catalog.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteService}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
