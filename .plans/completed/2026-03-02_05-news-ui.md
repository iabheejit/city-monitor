# Milestone 05 — News UI

**Goal:** Connect the frontend to the news API. Display live-updating news in the dashboard. This completes the MVP.

**Depends on:** [03-frontend-shell.md](03-frontend-shell.md), [04-news-pipeline.md](04-news-pipeline.md)

---

## Steps

### 1. React Query hooks (`packages/web/src/hooks/`)

**Reference patterns (adapted, not ported directly):**
- `.worldmonitor/src/app/refresh-scheduler.ts` — visibility-aware polling with jitter, backoff, and hidden-tab multiplier
- `.worldmonitor/src/utils/circuit-breaker.ts` — stale-while-revalidate, persistent cache, retry with cooldown

React Query replaces both of these. The key worldmonitor behaviors mapped to React Query config:

```typescript
// hooks/useNewsDigest.ts
export function useNewsDigest(cityId: string) {
  return useQuery({
    queryKey: ['news', 'digest', cityId],
    queryFn: () => api.getNewsDigest(cityId),
    refetchInterval: 5 * 60 * 1000,        // 5 min (= RefreshScheduler interval)
    refetchIntervalInBackground: false,      // pause when tab hidden (= hidden-tab multiplier)
    staleTime: 2 * 60 * 1000,              // 2 min
    gcTime: 30 * 60 * 1000,                 // keep 30 min (= circuit breaker cache TTL)
    retry: 2,                                // = maxFailures before circuit trips
    retryDelay: (attempt) =>                 // = exponential backoff
      Math.min(1000 * 2 ** attempt, 5 * 60 * 1000),
    placeholderData: keepPreviousData,       // = stale-while-revalidate
  });
}
```

### 2. Bootstrap hook (`packages/web/src/hooks/useBootstrap.ts`)

**Reference:** `.worldmonitor/src/services/bootstrap.ts`
- Calls bootstrap endpoint on page load with 800ms timeout
- Hydrates a Map that individual services drain on first call

```typescript
export function useBootstrap(cityId: string) {
  return useQuery({
    queryKey: ['bootstrap', cityId],
    queryFn: () => api.getBootstrap(cityId),
    staleTime: 60 * 1000,  // 1 min — bootstrap is a one-shot hydration
    gcTime: 5 * 60 * 1000,
  });
}
```

The bootstrap data pre-populates React Query's cache for individual queries:

```typescript
// In App.tsx or CityProvider
const { data: bootstrap } = useBootstrap(cityId);

useEffect(() => {
  if (!bootstrap) return;
  if (bootstrap.news) queryClient.setQueryData(['news', 'digest', cityId], bootstrap.news);
  if (bootstrap.weather) queryClient.setQueryData(['weather', cityId], bootstrap.weather);
  // ... etc
}, [bootstrap]);
```

### 3. NewsBriefingPanel (`packages/web/src/components/panels/NewsBriefingPanel.tsx`)

Displays:
- Top headlines grouped by category
- Source name + tier badge (Tier 1 sources highlighted)
- Time since publication ("12 min ago")
- Category tag (color-coded)
- Link to original article

```tsx
function NewsBriefingPanel() {
  const { cityId } = useCityConfig();
  const { data, isLoading, dataUpdatedAt } = useNewsDigest(cityId);

  if (isLoading) return <Panel title="News"><Skeleton lines={8} /></Panel>;

  return (
    <Panel title="News" lastUpdated={dataUpdatedAt}>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {data.items.slice(0, 20).map(item => (
          <NewsItem key={item.id} item={item} />
        ))}
      </ul>
    </Panel>
  );
}
```

### 4. Category filter tabs

Horizontal scrollable tabs above the news list: All | Local | Transit | Politics | Culture | Crime | Weather | Economy | Sports

Clicking a tab filters `data.items` by category. "All" shows the mixed feed sorted by tier + recency.

### 5. Relative time formatting

Use `Intl.RelativeTimeFormat` for "3 min ago", "2 hours ago" etc. No external dependency needed.

### 6. Virtual list (optional, if needed)

**Reference:** `.worldmonitor/src/components/` — VirtualList component with DOM recycling

If the news list exceeds ~50 items and scrolling feels sluggish, add `@tanstack/react-virtual` for windowed rendering. For MVP, a simple `.slice(0, 30)` is fine.

---

## Done when

- [ ] Dashboard loads and shows Berlin news headlines within 2 seconds
- [ ] Bootstrap endpoint hydrates all data on initial load
- [ ] News auto-refreshes every 5 min without manual reload
- [ ] News pauses refreshing when the tab is hidden
- [ ] Category filter tabs work (All, Local, Transit, Politics, etc.)
- [ ] Each headline shows source, tier badge, time ago, category tag
- [ ] Clicking a headline opens the source article in a new tab
- [ ] Loading state shows skeleton, error state shows a retry button
- [ ] **This is the MVP — a working Berlin news dashboard**
