---
title: Metrics Dashboard
subtitle: Weekly growth snapshot for the pyrola workspace
dateRange: Mar 10 – Mar 16, 2026
source: Sample fixture data
---

Activity picked up after the onboarding refresh shipped. Active users and signups are up week over week, while support volume rose with the broader launch push — still within the range we modeled for GA, but worth watching through April.

## Headline metrics

::metrics
---
items:
  - label: Active users
    value: "12.4k"
    delta: "+8%"
    tone: positive
  - label: Churn
    value: "2.1%"
    delta: "-0.3%"
    tone: positive
  - label: Support tickets
    value: "184"
    delta: "+12%"
    tone: negative
---
::

West continues to lead signups, but EU is closing the gap as localization work lands. East is steady; we do not need to rebalance spend yet.

::chart{type="bar" title="Signups by region" xLabel="Region" yLabel="Signups" source="Sample data"}
---
data:
  - region: West
    value: 4200
  - region: East
    value: 3100
  - region: EU
    value: 2800
---
::

Paid campaigns are performing within target. Brand still carries ROAS; retargeting remains efficient at smaller scale.

::table
---
title: Campaign performance
columns:
  - key: campaign
    label: Campaign
  - key: spend
    label: Spend
    align: right
  - key: roas
    label: ROAS
    align: right
rows:
  - campaign: Brand
    spend: "$42k"
    roas: "3.1x"
  - campaign: Retargeting
    spend: "$18k"
    roas: "2.4x"
---
::
