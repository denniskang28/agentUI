# Benchmark usage and measurement boundaries

Choose a component, mode, load, instance count, update frequency and duration in Benchmarks. Run Native or Sandbox alone, or Compare Both sequentially using the same fixture and update sequence. Starting clears the Playground preview to avoid background interference. Stopping cancels queued work and old Mock responses; leaving the page destroys the independent benchmark preview.

Heatmaps support 100 / 1,000 / 10,000 data cells, with four metrics per row. Tables support the same numbers of records. Choose 1 / 3 / 5 separate Surface instances, 1 / 10 / 30 / 60 Hz and 1–60 seconds. Large fixtures use a visible window while retaining the complete DataModel. Other plugins use their original fixture; an unsupported update fixture fails explicitly instead of inventing a load.

| Metric | Actual boundary |
|---|---|
| Cold instance ready | Per-mode reset / initial render to the trusted wrapper's first React layout commit / ready for every instance. Includes catalog and plugin module loading. Creates fresh instances with normal browser caching; does not force a cold HTTP cache |
| First content render | The first instance has nonempty content with nonzero dimensions and reaches a display opportunity after React commit and two requestAnimationFrame callbacks. This approximation cannot prove physical pixel presentation or semantic completeness of arbitrary third-party content |
| Update P50 / P95 | Preview Host receives data to every target's actual React commit. Each wrapper reports performance.timeOrigin + performance.now(), converted to the Host clock, excluding Sandbox return transport. Raw samples also retain Playground request-to-receipt RTT |
| Action stages | A real click records click → Host, Host → Playground, actual Mock wait / response, response → component commit, and total round trip. Total includes the receipt channel. Unavailable until an interaction occurs |
| Long tasks | When supported, PerformanceObserver records longtask entries observable by Preview Host during the run, including count and total duration. Coverage and attribution to opaque Sandboxes are incomplete |
| Memory | When available, performance.memory supplies a JS heap snapshot, baseline and delta. Browsers may quantize or share these values across contexts. They cannot precisely identify an individual iframe's usage. Unsupported values are null |
| Errors | Exports Load / Render / Bridge / Measurement / Other diagnostic counts and original messages. One cause can produce multiple stage diagnostics. Builds occur before selecting an installed component, so build is null for this run; actual build errors remain available in Plugins |

Initial measurement waits for all instances to become ready but only the first instance's display opportunity: browsers may pause animation frames in offscreen Sandboxes. Updates still measure every instance's commit. Cross-document clocks have limited precision. A 1 ms clock-resolution tolerance clamps tiny negative intervals to zero; raw event times and clockToleranceMs remain available. Clearly invalid timestamps are rejected.

Scheduling uses absolute target times. It skips a cycle when more than one period late or eight requests are still pending, rather than sending a catch-up burst. A newer update marks an uncommitted older request as superseded. Skipped, superseded, timed-out and failed updates do not enter successful-sample P50/P95. Compare achieved frequency, successful samples and dropped work alongside latency.

Exported benchmark/1.0 JSON includes browser information, plugin JavaScript artifact bytes, configuration, runId, initial component stages, raw update records, statistics scope, real interactions and errors. Built-in bundle size is null. A local run does not establish general performance or a fixed Native-versus-Sandbox advantage.

Telemetry is separate from A2UI wire messages and business DataModels. Normal preview requests still complete on official Core acknowledgment; Benchmark explicitly waits for component measurements. Older artifacts without the trusted commit probe time out as unavailable and must be rebuilt through the normal upload path. They never fall back to simulated timings.

Validation: tests/e2e/benchmarks.spec.ts uses real Docker artifacts, both modes, large fixtures, actual clicks, stopping/disposal and module-load failure recovery. tests/unit/measurement.test.ts covers multiple targets, clocks, stale receipts, superseded work and target validation. Screenshots and raw local runs are stored under artifacts/visual/benchmarks.
