# HR Planning: Eventi lifecycle, allocazioni CDC temporali, e confronto per centro di costo

**Data:** 2026-04-08
**Branch:** feature/hr-planning

## Contesto

Il sistema HR Planning esistente gestisce scenari, eventi pianificati (planned changes), centri di costo con allocazioni statiche, e date contratto su membri. Mancano:

1. UX per gestire date contratto nel catalogo membri
2. Allocazioni CDC che variano nel tempo tramite eventi
3. Filtro per centro di costo nelle viste planning e comparison

## Riepilogo decisioni

| Tema | Decisione |
|---|---|
| Dimissioni / nuova assunzione | Gestiti tramite `contract_start_date` / `contract_end_date` già in DB. Aggiungere UX (form + badge). |
| Maternità | Nessun concetto specifico. Si modella con eventi su `capacity_percentage` e `salary`. |
| Cambio allocazione CDC nel tempo | Nuovo tipo di evento `cost_center_allocations` nel sistema eventi esistente. |
| Versioni salvate CDC | Gli scenari HR fungono da versioni. Arricchire la comparison view con filtro per CDC. |
| Confronto per CDC | Selettore CDC nelle viste Planning e Comparison, che filtra KPI e tabella mensile. |

## 1. Form membri — campi date contratto

### Modifica

Aggiungere al dialog di creazione/modifica membro nel catalogo (`WorkforceCard.tsx`, `MemberList.tsx`) una riga con due date picker:

- **Data inizio contratto** (`contract_start_date`) — opzionale, default vuoto (= membro già attivo)
- **Data fine contratto** (`contract_end_date`) — opzionale, default vuoto (= tempo indeterminato)

Validazione: se entrambe presenti, `contract_end_date` > `contract_start_date`.

### Badge nella lista membri

Nella data-table dei membri, badge sulla colonna nome:

| Stato | Condizione | Badge |
|---|---|---|
| Da assumere | `contract_start_date` > oggi | Blu |
| Attivo | Nessuna end date, oppure end date futura e start date passata/nulla | Nessun badge (default) |
| In uscita | `contract_end_date` futura e ≤ 6 mesi da oggi | Arancione |
| Terminato | `contract_end_date` ≤ oggi | Grigio, riga attenuata |

### Tipo `MemberInput`

Aggiungere `contract_start_date?: string | null` e `contract_end_date?: string | null` se non già presenti.

## 2. Allocazioni CDC come eventi

### Nuovo tipo di campo evento

Estendere `MemberEventField` con il valore `'cost_center_allocations'`.

### Nuova tabella: `event_cost_center_allocations`

```sql
CREATE TABLE event_cost_center_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_event_id UUID REFERENCES member_events(id) ON DELETE CASCADE,
  scenario_member_event_id UUID REFERENCES scenario_member_events(id) ON DELETE CASCADE,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE NOT NULL,
  percentage NUMERIC NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  UNIQUE(member_event_id, cost_center_id),
  UNIQUE(scenario_member_event_id, cost_center_id),
  CHECK (
    (member_event_id IS NOT NULL AND scenario_member_event_id IS NULL) OR
    (member_event_id IS NULL AND scenario_member_event_id IS NOT NULL)
  )
);
```

RLS: l'utente può accedere alle righe il cui `member_event_id` appartiene a un evento di un membro con lo stesso `user_id`, oppure il cui `scenario_member_event_id` appartiene a un evento di uno scenario con lo stesso `user_id`. Stessa logica delle tabelle evento parent, implementata tramite subquery o join nelle policy.

### Tipo TypeScript

```typescript
type EventCostCenterAllocation = {
  id: string
  member_event_id: string | null
  scenario_member_event_id: string | null
  cost_center_id: string
  percentage: number
}
```

### Valore dell'evento

Quando `field = 'cost_center_allocations'`, il campo `value` nell'evento è `null`. I dati reali sono nella tabella `event_cost_center_allocations` collegata tramite FK.

### UX nel dialog eventi (`HREventDialog`)

Quando l'utente seleziona il campo "Allocazione centri di costo":

- L'input singolo (numero/select) viene sostituito da una mini-tabella:
  - Righe: centri di costo esistenti (da `useCostCenters`)
  - Colonna: percentuale (input numerico per riga)
  - Footer: totale percentuali con warning visivo se diverso da 100%
- Il resto del dialog invariato (data inizio, data fine opzionale, nota)

### CRUD

- **Creazione:** salva evento con `field = 'cost_center_allocations'`, `value = null`, poi insert righe in `event_cost_center_allocations`
- **Modifica:** update evento, poi upsert/delete righe allocazione
- **Eliminazione:** cascade delete tramite FK

## 3. Computation engine

### Risoluzione allocazioni CDC per mese

Nuova funzione in `resolve-events.ts`:

```
resolveCostCenterAllocationsForMonth(
  events: MemberEvent[] | ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  month: Date
): EventCostCenterAllocation[] | null
```

Logica:
1. Filtra eventi con `field = 'cost_center_allocations'` e `start_date ≤ fine mese`
2. Tra quelli la cui `end_date` copre il mese (o senza end_date), prende il più recente per `start_date`
3. Restituisce le allocazioni da `event_cost_center_allocations` per quell'evento
4. Se nessun evento trovato → `null` (= usa allocazioni statiche)

### Modifica a `computeMonthlySnapshot`

Nuovo parametro: `eventAllocations: EventCostCenterAllocation[]`.

Per ogni membro:
1. Chiama `resolveCostCenterAllocationsForMonth` con gli eventi del membro
2. Se ritorna allocazioni → usa quelle per distribuire costo/capacity/FTE per CDC
3. Se ritorna null → fallback alle allocazioni statiche da `member_cost_center_allocations`

### Nuovi breakdown in `MonthlySnapshot`

Aggiungere:
- `capacityByCostCenter: Record<string, number>` — capacity allocata per CDC
- `fteByCostCenter: Record<string, number>` — FTE per CDC
- `headcountByCostCenter: Record<string, number>` — headcount per CDC

Calcolati applicando le percentuali di allocazione (risolte o statiche) ai valori del membro.

### Aggregazione in `YearlyView`

`YearlyView` aggrega i nuovi breakdown mensili allo stesso modo di `personnelCostByCostCenter`:
- `capacityByCostCenter`: somma mensile
- `fteByCostCenter`: media mensile
- `headcountByCostCenter`: media mensile

### Firma aggiornata

```
computeMonthlySnapshot(members, events, settings, allocations, eventAllocations, month)
computeYearlyView(members, events, settings, allocations, eventAllocations, year)
```

## 4. Data fetching

### Caricamento allocazioni evento

- `useMemberEvents`: dopo aver caricato gli eventi, query aggiuntiva su `event_cost_center_allocations` per tutti gli eventi con `field = 'cost_center_allocations'`. Restituisce `eventAllocations` come `Record<string, EventCostCenterAllocation[]>` (chiave = event ID) oppure come array flat.
- `useHRScenarios` (`fetchHRScenarioWithData`): stessa logica per `scenario_member_events`.

### Passaggio al computation engine

```
page.tsx
  ├─ useMembers() → members
  ├─ useMemberEvents() → events, eventAllocations
  ├─ useCostCenters() → costCenters, allocations
  ├─ useSettings() → settings
  └─ useHRPlanning(members, events, settings, allocations, eventAllocations, year)
       └─ computeYearlyView(...)
```

Per scenari, `fetchHRScenarioWithData` ritorna anche `eventAllocations`.

## 5. Filtro CDC nelle viste

### Selettore

Un componente `Select` posizionato accanto al selettore anno, presente sia nella tab Planning che nella tab Comparison:

- **Opzioni:** "Tutti i centri di costo" (default) + un'opzione per ogni CDC esistente
- **Dati:** da `useCostCenters` → `costCenters`

### Comportamento filtro — tab Planning

Quando selezionato un CDC specifico:
- **KPI cards:** mostrano solo i valori allocati a quel CDC (costo, capacity, FTE, headcount dal breakdown per CDC)
- **Yearly table:** mostra solo i valori allocati a quel CDC per ogni membro/mese
- **Event list:** invariata (gli eventi sono per membro, non per CDC)

Quando "Tutti" → comportamento attuale (totali).

### Comportamento filtro — tab Comparison

Quando selezionato un CDC specifico:
- I KPI di confronto (source A vs source B) usano i valori filtrati per quel CDC
- I delta si calcolano tra i valori filtrati
- La tabella mensile di confronto mostra i costi filtrati per quel CDC

## Scope escluso

- Nessun concetto specifico per tipo di uscita (dimissioni vs licenziamento vs fine contratto)
- Nessun collegamento esplicito sostituto ↔ uscente
- Nessuna pagina nuova — tutto si integra nelle viste esistenti
- Nessun concetto specifico di maternità — si modella con eventi esistenti
