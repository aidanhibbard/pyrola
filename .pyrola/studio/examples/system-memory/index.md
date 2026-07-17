---
title: System Memory Snapshot
subtitle: Example ops layout
status: draft
source: Local shell inspection
---

::metrics
---
items:
  - label: Physical memory
    value: "32 GB"
  - label: Memory pressure
    value: Moderate
    tone: neutral
  - label: Compressed
    value: "3.5 GB"
---
::

::table
---
title: Top processes
columns:
  - key: process
    label: Process
  - key: memory
    label: Memory
    align: right
  - key: share
    label: Share
    align: right
rows:
  - process: Firefox
    memory: "7.0 GB"
    share: "21%"
  - process: Cursor
    memory: "8.4 GB"
    share: "25%"
  - process: Discord
    memory: "1.1 GB"
    share: "3%"
---
::

::callout{tone="info" title="Takeaway"}
Memory pressure is elevated but the system is not swapping. Consider closing unused browser profiles during heavy agent sessions.
::
