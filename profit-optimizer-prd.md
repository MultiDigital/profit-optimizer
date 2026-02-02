# Revenue Optimizer
## Product Requirements Document

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Product Definition

---

## Executive Summary

Revenue Optimizer is a capacity planning and revenue maximization tool designed for professional service businesses (agencies, consultancies, studios). It uses mathematical optimization to determine the optimal mix of projects a team should pursue to maximize profitability, given their staffing constraints and market demand.

The tool answers the fundamental question every service business faces: **"Given our team and the services we offer, what's the most profitable way to allocate our capacity?"**

---

## Problem Statement

### The Core Challenge

Professional service businesses sell time. They have a fixed team with limited capacity, and they must decide:
- Which projects to take on
- How to staff those projects
- Whether to hire more people
- Which services to promote or retire

Most businesses make these decisions intuitively, leaving significant revenue on the table.

### Why Current Solutions Fail

1. **Spreadsheets** — Manual calculations break down with multiple services, seniority levels, and constraints
2. **Project Management Tools** — Track work but don't optimize for profitability
3. **Financial Software** — Reports on past performance but doesn't model future scenarios
4. **Intuition** — Biased toward familiar patterns, misses non-obvious optimal solutions

### The Opportunity

A tool that mathematically optimizes the project mix can reveal insights like:
- "You're understaffed at the Middle level — hiring one person would unlock €50,000 in additional margin"
- "Service X looks profitable but consumes Senior capacity that could generate more margin on Service Y"
- "Your bottleneck isn't capacity, it's sales — you have unused capacity but all demand is met"

---

## First Principles

The following principles guided every design decision. They should guide future development.

### Principle 1: Two-Layer Profitability

**Insight:** There are two ways to measure profitability, and conflating them leads to bad decisions.

| Layer | Name | Formula | Answers |
|-------|------|---------|---------|
| 1 | Contribution Margin | Revenue - Variable Costs | "Which service is more profitable per unit?" |
| 2 | True Profit | Contribution - Fixed Costs | "Will we make money this year?" |

**Variable costs** scale with work (day rates × days worked).  
**Fixed costs** are incurred regardless of work (salaries).

**Why it matters:**
- A service with 60% contribution margin looks great
- But if your team is 50% utilized, you're losing money
- True Profit reveals this; Contribution Margin alone hides it

**Implementation:**
- Track both contribution margin (per project) and true profit (total)
- Show break-even revenue: the minimum to cover fixed costs
- When evaluating hiring: show both the capacity gain AND the salary cost

### Principle 2: Seniority is Fungible (With Friction)

**Insight:** A Senior developer CAN do Junior work, but it's inefficient to pay Senior rates for Junior tasks. However, if you have no Juniors and excess Senior capacity, substitution is better than leaving capacity idle.

**The efficiency model:**
- Higher seniority working below their level = faster completion (they're more skilled)
- But the cost is higher (their rate is higher)
- The optimizer should choose: use the right level, OR substitute if it maximizes total profit

**Efficiency gains when substituting:**
| Levels Down | Efficiency Gain | Example |
|-------------|-----------------|---------|
| 1 level | 5% faster | Senior doing Middle Up work |
| 2 levels | 10% faster | Senior doing Middle work |
| 3 levels | 20% faster | Senior doing Junior work |

**Why it matters:**
- Without substitution, a missing seniority level blocks entire services
- With substitution, the optimizer can find creative staffing solutions
- The efficiency gains prevent gaming (making substitution always better)

### Principle 3: Demand is a Constraint, Not a Goal

**Insight:** You can't sell unlimited projects. Each service has a market demand cap — the maximum the market will buy at your price.

**Why it matters:**
- Without demand caps, the optimizer would say "do infinite projects"
- With demand caps, the optimizer reveals the TRUE bottleneck:
  - If capacity is exhausted first → **hire more people**
  - If demand is exhausted first → **invest in sales/marketing** or **raise prices**

**Bottleneck detection logic:**
```
IF all allocated services are at demand cap:
  Bottleneck = "Sales"
ELSE:
  Bottleneck = seniority level with least remaining capacity
```

### Principle 4: Optimize for Margin, Not Revenue

**Insight:** Revenue maximization and margin maximization often suggest different strategies.

**Example:**
- Service A: €10,000 revenue, €2,000 margin
- Service B: €5,000 revenue, €3,000 margin

Revenue optimization says: "Do Service A"  
Margin optimization says: "Do Service B"

**Why it matters:**
- High-revenue services may consume capacity that could generate more profit elsewhere
- The goal is profit, not vanity metrics

### Principle 5: Capacity is Time × Utilization

**Insight:** A person doesn't contribute 100% of their time to billable work.

**Formula:**
```
Effective Capacity = Days per Month × Utilization % × 12 months
```

**Utilization accounts for:**
- Meetings, admin, training
- Sick days, holidays
- Bench time between projects

**Typical values:** 70-85% utilization for a well-run agency

---

## User Personas

### Primary: Agency Owner / Business Unit Manager

**Context:**
- Manages a team of 5-50 professionals
- Sells multiple service types to clients
- Must decide: hiring, pricing, which work to pursue
- Currently uses spreadsheets and intuition

**Goals:**
- Maximize profitability
- Understand capacity constraints
- Make data-driven hiring decisions
- Identify which services to promote or retire

**Pain points:**
- "I don't know if we should hire another developer or designer"
- "I'm not sure which projects are actually most profitable"
- "We're busy but not making as much money as we should"

### Secondary: Operations Manager / Resource Planner

**Context:**
- Allocates people to projects
- Tracks utilization
- Reports to leadership on capacity

**Goals:**
- Balance workload across team
- Identify bottlenecks before they become problems
- Plan for upcoming demand

---

## Feature Specifications

### F1: Team Management

**Purpose:** Define the workforce and their costs.

**Data model — Team Member:**
| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Identifier for the person |
| Seniority | Enum | Senior, Middle Up, Middle, Junior |
| Days per Month | Number | Working days available (typically 20-22) |
| Utilization % | Number | Percentage of time on billable work (typically 70-85%) |
| Salary (yearly) | Currency | Fixed cost for this person |

**Data model — Seniority Level:**
| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Level name |
| Billing Rate | Currency/day | What clients are charged (or internal transfer price) |

**Derived calculations:**
- Effective days/month = Days × Utilization%
- Yearly capacity = Effective days/month × 12
- Total capacity per level = Sum of all members at that level

**UI requirements:**
- Add/remove team members
- Inline editing of all fields
- Show effective capacity in real-time
- Group display by seniority level

### F2: Service Definition

**Purpose:** Define what the business sells and how it's staffed.

**Data model — Service:**
| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Service identifier |
| Senior Days | Number | Days of Senior work required |
| Middle Up Days | Number | Days of Middle Up work required |
| Middle Days | Number | Days of Middle work required |
| Junior Days | Number | Days of Junior work required |
| Price | Currency | What clients pay for this service |
| Max per Year | Number (nullable) | Demand cap — maximum sellable |

**Derived calculations:**
- Cost = Σ (Days per level × Rate per level)
- Contribution Margin = Price - Cost
- Margin % = Margin / Price

**UI requirements:**
- Add/remove services
- Inline editing of all fields
- Show cost and margin in real-time
- Visual indicator for margin health (green/yellow/red)

### F3: Seniority Substitution Engine

**Purpose:** Automatically generate alternative staffing options for each service.

**Logic:**

For each service, generate variants where higher seniority levels absorb lower-level work:

1. **Original variant** — staffed as defined
2. **Senior→All variant** — Senior does all Middle Up, Middle, and Junior work
3. **Middle Up→Below variant** — Middle Up does all Middle and Junior work
4. **Middle→Junior variant** — Middle does all Junior work

**Efficiency adjustment:**
```
Adjusted Days = Original Days × (1 - Efficiency Gain)
```

**Example:**
- Original: 2 Senior + 8 Junior days
- Senior→All variant: 2 + (8 × 0.80) = 8.4 Senior days

**Output:** Array of variant objects, each with adjusted day requirements and recalculated costs/margins.

### F4: Optimization Engine

**Purpose:** Find the project mix that maximizes total margin.

**Mathematical formulation:**

```
MAXIMIZE: Σ (quantity[v] × margin[v]) for all variants v

SUBJECT TO:
  - Σ (quantity[v] × seniorDays[v]) ≤ seniorCapacity
  - Σ (quantity[v] × middleUpDays[v]) ≤ middleUpCapacity
  - Σ (quantity[v] × middleDays[v]) ≤ middleCapacity
  - Σ (quantity[v] × juniorDays[v]) ≤ juniorCapacity
  - Σ quantity[v] for variants of service S ≤ demandCap[S]
  - quantity[v] ≥ 0 and integer
```

**Algorithm:** Integer Linear Programming (ILP) with branch-and-bound.

**Output:**
- Quantity of each service/variant to deliver
- Total revenue, contribution margin, true profit
- Capacity utilization per seniority level
- Bottleneck identification

### F5: Financial Dashboard

**Purpose:** Display optimization results with business context.

**Metrics to display:**

| Metric | Formula | Purpose |
|--------|---------|---------|
| Yearly Revenue | Σ (quantity × price) | Top line |
| Contribution Margin | Σ (quantity × margin) | Variable profitability |
| Contribution % | Contribution / Revenue | Efficiency ratio |
| Fixed Costs | Σ salaries | Overhead |
| True Profit | Contribution - Fixed Costs | Bottom line |
| Profit Margin % | True Profit / Revenue | Business health |
| Break-even Revenue | Fixed Costs / Contribution % | Minimum viable revenue |

**Visual elements:**
- Capacity utilization bars per seniority level
- Project mix breakdown with per-service revenue/margin
- Bottleneck indicator (seniority name or "Sales")
- Demand cap vs capacity indicators

### F6: Bottleneck Detection

**Purpose:** Tell the user what's limiting their growth.

**Logic:**
```
IF all allocated services are at their demand cap:
  bottleneck = "Sales"
  recommendation = "Increase demand caps, add services, or raise prices"
ELSE:
  bottleneck = seniority level with minimum (capacity - used)
  recommendation = "Hire more [bottleneck level] or reduce [bottleneck] requirements"
```

**Display:**
- Clear bottleneck label
- Contextual recommendation
- Supporting data (e.g., "3/3 services at demand cap")

### F7: Scenario Assistant (AI Chat)

**Purpose:** Enable natural-language exploration of what-if scenarios.

**Capabilities:**
- Answer questions about current configuration
- Calculate impact of changes ("What if I hire 2 juniors?")
- Suggest improvements based on data
- Explain optimization results

**Context provided to AI:**
- Full team composition with capacities and salaries
- All services with staffing, pricing, margins
- Current optimization results
- Utilization percentages and bottleneck

**Example interactions:**
- "Which service has the best margin efficiency?"
- "What happens if I raise Website prices by 20%?"
- "How many more juniors do I need to eliminate the Junior bottleneck?"
- "Should I hire a Senior or two Middles?"

**Technical requirement:**
- API key configuration for local/self-hosted deployment
- Works seamlessly in hosted environments

### F8: Data Persistence

**Purpose:** Save and restore user configurations.

**Storage requirements:**
- Team members (all fields)
- Services (all fields)
- Billing rates
- Settings/preferences

**Implementation options:**
- Browser local storage (default)
- Export/import JSON
- Cloud sync (future)

**Data migration:**
- Version tracking for schema changes
- Automatic migration on version bump
- Clear legacy data when incompatible

---

## User Flows

### Flow 1: Initial Setup

1. User opens application
2. System shows empty state with guidance
3. User sets billing rates for each seniority level
4. User adds team members (name, seniority, days, utilization, salary)
5. User adds services (name, staffing, price, demand cap)
6. System calculates and displays optimal mix

### Flow 2: Scenario Exploration

1. User views current optimization results
2. User asks AI: "What if I hire another Middle?"
3. AI calculates impact using current data
4. AI responds with concrete numbers
5. User decides whether to make the change
6. User updates team, sees new optimization

### Flow 3: Pricing Decision

1. User notices Service X has low margin
2. User increases price in service definition
3. System recalculates optimization
4. User observes: higher margin but fewer projects (demand elastic)
5. User adjusts demand cap to reflect price sensitivity
6. System shows net impact on profitability

### Flow 4: Hiring Decision

1. User observes bottleneck: "Senior"
2. User considers: hire Senior ($80k) or two Middles ($100k total)?
3. User asks AI for analysis
4. AI shows: Middles add more capacity but may not substitute for Senior requirements
5. User makes informed decision

---

## Technical Requirements

### Performance

- Optimization must complete in <2 seconds for typical configurations (10 services, 20 team members)
- UI updates must feel instantaneous (<100ms)
- Should handle edge cases gracefully (no team, no services, impossible constraints)

### Compatibility

- Must work in modern browsers (Chrome, Firefox, Safari, Edge)
- Should be usable on tablet devices
- Desktop-first design, responsive as secondary

### Accessibility

- Keyboard navigation support
- Screen reader compatible labels
- Sufficient color contrast
- No information conveyed by color alone

### Data Integrity

- No data loss on browser refresh
- Graceful handling of corrupted storage
- Export capability for backup

---

## Success Metrics

### Adoption

- Time to first meaningful optimization (target: <5 minutes)
- Return usage rate (target: >40% weekly active)
- Feature discovery rate (demand caps, substitution, AI chat)

### Value Delivery

- User-reported "aha moments" (qualitative)
- Decisions influenced by tool (survey)
- Profit improvement attributed to tool (case studies)

### Engagement

- Sessions per user per week
- AI chat interactions per session
- Scenarios explored per session

---

## Future Considerations

### Potential Enhancements

1. **Multi-scenario comparison** — Save and compare different configurations side-by-side
2. **Time-based planning** — Monthly/quarterly projections with seasonality
3. **Client/project tracking** — Connect actual work to projections
4. **Team skill matrix** — Beyond seniority, model individual capabilities
5. **Price elasticity modeling** — Automatically adjust demand based on price changes
6. **Integration with PM tools** — Import actuals from Asana, Monday, etc.
7. **Collaborative mode** — Multiple users, shared configurations

### Known Limitations

1. **Single-period model** — Assumes stable capacity and demand over the year
2. **No partial projects** — Projects are integer units (can't do 0.5 websites)
3. **No project dependencies** — Services are independent
4. **Simplified substitution** — Only "all-in" substitution, not hybrid staffing

---

## Glossary

| Term | Definition |
|------|------------|
| Contribution Margin | Revenue minus variable costs; profit before fixed costs |
| True Profit | Contribution minus fixed costs; actual bottom-line profit |
| Seniority Level | A tier in the workforce hierarchy (Senior, Middle Up, Middle, Junior) |
| Billing Rate | The cost per day assigned to each seniority level |
| Demand Cap | Maximum quantity of a service the market will purchase |
| Utilization | Percentage of working time spent on billable activities |
| Substitution | Higher seniority doing lower-level work with efficiency gains |
| Bottleneck | The constraint that limits further growth (capacity or sales) |
| Break-even | The revenue required to cover all fixed costs |
| ILP | Integer Linear Programming; mathematical optimization technique |

---

## Appendix: Mathematical Model

### Decision Variables

- `q[v]` = quantity of variant v to produce (non-negative integer)

### Objective Function

Maximize total contribution margin:
```
max Σ q[v] × margin[v]
```

### Constraints

**Capacity constraints (one per seniority level):**
```
Σ q[v] × days[v][level] ≤ capacity[level]
```

**Demand constraints (one per base service):**
```
Σ q[v] for all variants of service s ≤ demandCap[s]
```

**Integrality:**
```
q[v] ∈ {0, 1, 2, ...}
```

### Solution Method

Branch-and-bound algorithm with:
- Upper bound: LP relaxation
- Branching: most fractional variable
- Pruning: bound comparison

For small instances (<50 variants), exhaustive search with intelligent pruning is sufficient.
