 # Architecture

> Static snapshot — generated 2026-05-30. Re-run analysis when making large structural changes.

---

## 1. Слои и их нарушения

### Структура слоёв (FSD)

```
src/
├── app/          — провайдеры, роутер, глобальный контекст
├── views/        — GlobeScene (единственная view-страница)
├── widgets/      — FeedDrawer, GlobeControls, GlobeMap, LeftStrip, SidePanel
├── features/     — AddSpot, Auth, Cart, PublicGallery, SpotCover, SpotPreview, SpotSearch, Upload
├── entities/     — Media, Spot, SurfSession
├── shared/       — api, errors, hooks, lib, types, ui, validation
└── server/       — серверный код (не FSD-слой, изолирован)
```

### Нарушения зависимостей

**Нарушений не обнаружено.** Grep по всем направлениям вверх по слоям дал пустой результат:

- `shared/` не импортирует из `features/`, `widgets/`, `views/`, `app/`
- `entities/` не импортирует из `features/` или выше
- `features/` не импортирует из `widgets/` или выше

Единственный нестандартный импорт:

- [SpotStep.tsx](src/features/Upload/ui/steps/SpotStep.tsx):4 — `features/Upload` импортирует из `widgets/GlobeMap/model/mapStore`. Это допустимо в FSD: feature может обращаться к store виджета через его публичное API. Если строгость критична — store следует вынести в `entities/` или `shared/`.

---

## 2. Глобальное состояние — полная карта

Проект использует три Zustand-стора.

---

### `useCartStore` ([src/features/Cart/model/cartStore.ts](src/features/Cart/model/cartStore.ts))

**Persistence:** `localStorage`, ключ `wave-atlas-cart`

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| `items` | `CartItem[]` | Элементы в корзине |

**Экшены:**
| Экшен | Что делает |
|-------|-----------|
| `add(item)` | Добавляет, если нет дубликата по `id` |
| `remove(id)` | Удаляет по id |
| `clear()` | Очищает всё |
| `totalCents()` | Вычисляет сумму (через `get()`) |
| `hasItem(id)` | Проверяет наличие |

**Читают:**
- [_drawer.$spotId.index.tsx](src/app/routes/_drawer.$spotId.index.tsx) — кнопка "добавить в корзину"
- [_drawer.cart.tsx](src/app/routes/_drawer.cart.tsx) — отображение корзины
- [CartButton.tsx](src/widgets/LeftStrip/CartControl.tsx) — индикатор количества
- [useCartCheckout.ts](src/features/Cart/model/useCartCheckout.ts) — чтение `items` для checkout
- [useCartItem.ts](src/features/Cart/model/useCartItem.ts) — `hasItem`
- [useCartSessionSync.ts](src/features/Cart/model/useCartSessionSync.ts) — вызов `clear`

**Пишут:**
- [useCartItem.ts](src/features/Cart/model/useCartItem.ts) — `add`, `remove`
- [useCartCheckout.ts](src/features/Cart/model/useCartCheckout.ts) — `clear` после успешного checkout
- [useCartSessionSync.ts](src/features/Cart/model/useCartSessionSync.ts) — `clear` при разлогине

**Side-эффекты:**
- `useCartSessionSync` подписан на `isAuthenticated` и очищает стор при переходе authenticated→unauthenticated. Вызывается один раз в [__root.tsx](src/app/routes/__root.tsx).

---

### `useUploadStore` ([src/features/Upload/model/uploadStore.ts](src/features/Upload/model/uploadStore.ts))

**Persistence:** нет (in-memory только)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| `uploadingSpotId` | `string \| null` | Спот, для которого идёт загрузка |
| `uploadingSpotName` | `string \| null` | Название спота |
| `uploadQueue` | `UploadItem[]` | Все текущие элементы очереди |
| `sessionTotal` | `number` | Монотонный счётчик — сколько файлов в сессии |
| `sessionCompleted` | `number` | Сколько завершено в сессии |

**Экшены:**
| Экшен | Что делает |
|-------|-----------|
| `setSpotContext(spotId, spotName)` | Устанавливает контекст загрузки |
| `addToQueue(items)` | Добавляет элементы, сбрасывает счётчики если очередь была пуста |
| `incrementSessionCompleted()` | +1 к счётчику |
| `updateItem(id, updates)` | Patch одного элемента |
| `removeItem(id)` | Удаляет элемент |
| `clearCompleted()` | Убирает завершённые |
| `clearQueue()` | Сбрасывает всё, вызывает `abortUpload()` для активных |
| `isUploadingForSpot(spotId)` | Возвращает boolean |

**Читают:**
- [useUploadBlocking.ts](src/features/Upload/model/useUploadBlocking.ts) — `uploadingSpotId`, `globalHasActiveUploads`
- [useUploadStatus.ts](src/features/Upload/model/useUploadStatus.ts) — `sessionTotal`, `sessionCompleted`
- [UploadGallery.tsx](src/features/Upload/ui/UploadGallery/UploadGallery.tsx) — `uploadQueue` (через `useUploadQueue`)
- [UploadIndicatorAffix](src/features/Upload/ui/UploadIndicator/UploadIndicatorAffix.tsx) — статус

**Пишут:**
- [useUploadManager.ts](src/features/Upload/model/useUploadManager.ts) — все экшены через `getState()` внутри колбэков
- [useGooglePicker.ts](src/features/Upload/model/useGooglePicker.ts) — `addToQueue`, `removeItem`

**Side-эффекты:**
- Нет реактивных подписок. Запись идёт через `getState()` напрямую (вне React-рендера), чтение — через селекторы в хуках.

---

### `useMapStore` ([src/widgets/GlobeMap/model/mapStore.ts](src/widgets/GlobeMap/model/mapStore.ts))

**Persistence:** `sessionStorage`, ключ `wave-atlas-map`. Персистируется **только** `cameraState`.

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| `selectedSpot` | `Spot \| null` | Выбранный спот |
| `selectedSpotId` | `string \| null` | Дублирует `selectedSpot.id` (для обратной совместимости) |
| `showPreview` | `boolean` | Показывать ли popup превью |
| `cameraState` | `CameraState` | Позиция и зум карты |
| `interactionMode` | `'explore' \| 'pin-placement' \| 'spot-select'` | Режим взаимодействия |
| `tempPin` | `LngLat \| null` | Временный пин при создании спота |
| `pendingSpotName` | `string` | Имя из поиска для нового спота |

**Экшены:** `selectSpot`, `clearSelection`, `saveCameraState`, `enterPinPlacement`, `exitPinPlacement`, `enterSpotSelect`, `exitSpotSelect`, `setTempPin`, `clearTempPin`

**Читают:**
- [GlobeMapComponent.tsx](src/widgets/GlobeMap/GlobeMapComponent.tsx) — всё
- [SpotStep.tsx](src/features/Upload/ui/steps/SpotStep.tsx) — `selectedSpot`, `enterSpotSelect`, `exitSpotSelect`, `clearSelection`
- [AddSpotProvider.tsx](src/features/AddSpot/AddSpotProvider.tsx) — `interactionMode`, `tempPin`
- [GlobeScene.tsx](src/views/GlobeScene/GlobeScene.tsx) — `selectedSpotId`

**Пишут:**
- [useSpotFlyTo.ts](src/widgets/GlobeMap/hooks/useSpotFlyTo.ts) — `selectSpot`
- [useAddSpotFlow.ts](src/features/AddSpot/model/useAddSpotFlow.ts) — `enterPinPlacement`, `exitPinPlacement`
- [SpotSearch.tsx](src/features/SpotSearch/SpotSearch.tsx) — `selectSpot(spot, false)` (без превью)
- [SpotStep.tsx](src/features/Upload/ui/steps/SpotStep.tsx) — `enterSpotSelect`, `exitSpotSelect`, `clearSelection`

**Side-эффекты:**
- `clearSelection` содержит `console.trace(...)` — [mapStore.ts:66](src/widgets/GlobeMap/model/mapStore.ts#L66) (debug-код в проде).

---

## 3. SWR vs TanStack Query

### Вердикт: SWR — мёртвая зависимость

`swr@^2.4.0` прописан в [package.json](package.json), но **ни один файл в `src/` его не импортирует**. Grep по `from 'swr'` и `useSWR` дал пустой результат.

Весь data fetching ведётся через **TanStack Query + tRPC**:

| Хук/файл | Что делает |
|----------|-----------|
| [useReverseGeocode.ts](src/features/AddSpot/model/useReverseGeocode.ts) | `useQuery` — геокодирование через Mapbox API |
| [SpotSearch.tsx](src/features/SpotSearch/SpotSearch.tsx) | `useQuery` — поиск спотов |
| [_drawer.me.purchases.tsx](src/app/routes/_drawer.me.purchases.tsx) | `useQuery` — список покупок |
| [_drawer.me.index.tsx](src/app/routes/_drawer.me.index.tsx) | `useQuery` — профиль пользователя |
| [useCartCheckout.ts](src/features/Cart/model/useCartCheckout.ts) | `useMutation` — создание checkout |
| [SpotResultOption.tsx](src/features/SpotSearch/ui/SpotResultOption.tsx) | `useMutation` — добавление алиаса спота |
| [useAddSpotFlow.ts](src/features/AddSpot/model/useAddSpotFlow.ts) | `useMutation` — создание спота |
| [usePublish.ts](src/features/Upload/model/usePublish.ts) | `useMutation` — публикация сессии |
| [UploadSidebar.tsx](src/features/Upload/ui/UploadSidebar.tsx) | `useMutation` — создание сессии + публикация |

**Рекомендация:** удалить `swr` из `package.json`.

---

## 4. tRPC — два клиента

В проекте **два пакета tRPC**, и оба используются по делу.

### `@trpc/react-query` — **установлен, но не используется в src/**

Grep по `from '@trpc/react-query'` в `src/` дал пустой результат. Пакет установлен, но код на него не завязан. **Мёртвая зависимость** наряду с `swr`.

### `@trpc/tanstack-react-query` — основной

**Файлы:**

| Файл | Роль |
|------|------|
| [src/app/lib/trpc.ts](src/app/lib/trpc.ts) | `createTRPCContext` → экспортирует `TRPCProvider`, `useTRPC`, `useTRPCClient` |
| [src/app/lib/trpcClient.ts](src/app/lib/trpcClient.ts) | `createTRPCClient` + `createTRPCOptionsProxy` → `trpcClient`, `trpcProxy` |

**Клиент 1 — React context (`useTRPC`)**

```ts
// src/app/lib/trpc.ts
import { createTRPCContext } from '@trpc/tanstack-react-query';
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
```

Используется в компонентах через `useTRPC()` — возвращает прокси с `.queryOptions()` / `.mutationOptions()`. Ключ запроса рассчитывается автоматически. Это **React-способ**: подписка на кэш, invalidation, devtools.

**Клиент 2 — Imperative (`trpcClient` / `trpcProxy`)**

```ts
// src/app/lib/trpcClient.ts
export const trpcClient = createTRPCClient<AppRouter>({ ... });
export const trpcProxy = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
```

`trpcClient.X.mutate()` — прямой вызов, без React-хука. Используется внутри `UploadPipeline` и других не-React контекстов (колбэки, route loaders). `trpcProxy` используется в route loaders TanStack Router (`loader: () => trpcProxy.spots.list.prefetch()`).

**Это не дублирование — это два разных контекста использования.**

---

## 5. Карта инвалидаций кэша

| Файл | Строка | Событие-триггер | Ключ |
|------|--------|-----------------|------|
| [useDraftMedia.ts](src/features/Upload/model/useDraftMedia.ts) | 39 | `refetch()` после завершения загрузки файла | `sessions.draftMedia(sessionId)` |
| [useDraftMedia.ts](src/features/Upload/model/useDraftMedia.ts) | 45+53 | Добавление нового MediaItem в кэш (оптимистичное `setQueryData` + следом `invalidate`) | `sessions.draftMedia(sessionId)` |
| [useDraftMedia.ts](src/features/Upload/model/useDraftMedia.ts) | 58 | Удаление из черновиков | `sessions.draftMedia(sessionId)` |
| [useDraftMedia.ts](src/features/Upload/model/useDraftMedia.ts) | 68 | Обновление price/capturedAt (оптимистичное) | `sessions.draftMedia(sessionId)` |
| [usePublish.ts](src/features/Upload/model/usePublish.ts) | 33 | Успешная публикация сессии | `sessions.list` |
| [usePublish.ts](src/features/Upload/model/usePublish.ts) | 34 | Успешная публикация сессии | `sessions.mine` |
| [useDeleteMedia.ts](src/entities/Media/model/useDeleteMedia.ts) | 21 | Удаление медиафайла | `users.myUploads` |
| [useDeleteMedia.ts](src/entities/Media/model/useDeleteMedia.ts) | 22 | Удаление медиафайла | `users.myDraftCounts` |
| [usePublishMedia.ts](src/entities/Media/model/usePublishMedia.ts) | 17 | Публикация одного медиафайла | `spots.details` |
| [useAddSpotFlow.ts](src/features/AddSpot/model/useAddSpotFlow.ts) | 91 | Создание спота | `spots.list` (оптимистичный `setQueryData`, не invalidate) |

### Скрытые связи между фичами

- Публикация сессии (Upload) → инвалидирует `sessions.list` + `sessions.mine` → перерисовывает SessionFeed в SidePanel.
- Удаление медиафайла (entities/Media) → инвалидирует `users.myUploads` + `myDraftCounts` — оба отображаются в разделе "Мои загрузки".
- Добавление нового спота (AddSpot) → оптимистичный append в `spots.list` — сразу виден на глобусе без рефетча.

---

## 6. useEffect с подозрительными зависимостями

### Флаги (реальные проблемы)

**[UploadGallery.tsx:279–283](src/features/Upload/ui/UploadGallery/UploadGallery.tsx#L279)**
```tsx
useEffect(() => {
  if (!onProceed) return;
  if (items.length > 0) handleModalChange(true);
  else handleModalChange(false);
}, [items.length, onProceed]); // eslint-disable-line react-hooks/exhaustive-deps
```
`handleModalChange` вызывается внутри эффекта, но отсутствует в deps. `eslint-disable` скрывает потенциальный stale closure. Комментарий не объясняет, почему это намеренно.

**[mapStore.ts:66](src/widgets/GlobeMap/model/mapStore.ts#L66)**
```ts
clearSelection: () => {
  console.trace('[mapStore] clearSelection');  // debug-код в проде
  set({ selectedSpot: null, selectedSpotId: null, showPreview: false });
},
```
`console.trace` в production-коде Zustand-стора.

---

### Без тревоги (намеренные паттерны)

**[useUploadManager.ts:44–57](src/features/Upload/model/useUploadManager.ts#L44)**
```ts
useEffect(() => {
  const store = useUploadStore.getState();  // getState() вне React — намеренно
  // ... conditional setSpotContext
}, [spotId, spotName]);
```
`getState()` вызывается внутри эффекта, а не в render — это правильно для доступа к текущему значению без лишней подписки. Deps `[spotId, spotName]` корректны.

**[UploadManager.tsx:52–55](src/features/Upload/ui/UploadManager.tsx#L52)**
```ts
useEffect(() => { onQueueChangeRef.current = onQueueChange; });  // без deps
useEffect(() => {
  onQueueChangeRef.current?.(queue.length + importingItems.length);
}, [queue.length, importingItems.length]);
```
Классический ref-синхронизатор — стандартный паттерн для стабильных колбэков.

**[GlobeMapComponent.tsx:80–97](src/widgets/GlobeMap/GlobeMapComponent.tsx#L80)**
```ts
const resolvedInitialView = useMemo(() => { ... }, []);
// eslint-disable-line react-hooks/exhaustive-deps -- initial value only
```
`useMemo` с `[]` для вычисления начального состояния карты. `react-map-gl` игнорирует `initialViewState` после первого рендера — `[]` здесь семантически верно. Комментарий объясняет причину.

**[SpotStep.tsx:17–37](src/features/Upload/ui/steps/SpotStep.tsx#L17)**
Три `useEffect` синхронизируют состояние карты (`interactionMode`) с выбором спота. Все deps корректны, все возвращают cleanup.

**[useCartSessionSync.ts:16](src/features/Cart/model/useCartSessionSync.ts#L16)**
`useEffect` с `[isAuthenticated, isLoading, clearCart]` — очистка корзины при разлогине. Логика с `wasAuthenticatedRef` предотвращает срабатывание при гидрации.

---

## 7. Фичи Upload и Cart — отдельный разбор

### Upload

#### Поток данных (полный)

```
[1] UI → Spot selection
    UploadSidebar → SpotStep → SpotSearch (useQuery: spots.search)
    → useMapStore.selectSpot() + mapStore.exitSpotSelect()
    → SpotStep.onSelect(spot) → UploadSidebar.setSpot(spot)

[2] UI → File selection / drop
    UploadZone.onDrop → UploadManager.addFiles(files)
    → useUploadManager.addFiles()
      → createPendingItems(): UploadItem[] (id=uuid, status='pending', previewUrl=blobURL)
      → useUploadStore.addToQueue(items)
      → per file: processUpload(id, file)

[3] Pipeline per file
    processUpload(id, file)
    → validate file size (MEDIA_UPLOAD_LIMITS)
    → UploadPipeline.extractMetadata(file)  [shared/lib EXIF]
    → UploadPipeline.getSignature()
      → trpcClient.media.signCloudinary.mutate()  [imperative client]
      → store: status = 'signing'
    → UploadPipeline.uploadToCloud()
      → cloudinaryTransport.uploadToCloudinary() via XHR
      → store: status = 'uploading', progress%
    → UploadPipeline.saveToDatabase(cloudResult, exifData)
      → trpcClient.media.create.mutate({ spotId, sessionId?, cloudinaryResult })
      → store: status = 'saving'
    → UploadPipeline.complete()
      → store: status = 'completed', mediaId
      → store: incrementSessionCompleted()
    → draftCache.append(mediaItem)  [setQueryData → sessions.draftMedia]
    → invalidateQueries(sessions.draftMedia)  [фоновый рефетч]

[4] Queue merging (useUploadQueue)
    Zustand uploadQueue + TanStack Query sessions.draftMedia
    → Merge: completed Zustand items joined с TQ-результатами по mediaId
    → Server-only drafts (прошлые сессии) добавляются отдельно
    → hasActiveUploads = true пока хоть один item не completed/error

[5] Metadata editing
    User выбирает items → BulkEditToolbar → MetadataControls
    → useDraftEditing.handleBulkPriceEdit / handleBulkDateEdit
    → trpc.media.updateBatch.mutate (React-хук client)
    → draftCache.update(ids, { price, capturedAt })  [setQueryData]

[6] Publish (с sessionId)
    UploadSidebar.handlePublish()
    → usePublish.publishSession(sessionId)
      → trpc.sessions.publish.mutate(sessionId)
      → invalidate: sessions.list, sessions.mine
    → useUploadStore.removeByMediaIds(mediaIds)
    → draftCache.refetch()

[7] Publish (без sessionId — отложенная сессия)
    UploadSidebar.createAndPublish()
    → useMutation: trpc.sessions.createAndPublish({ spotId, startsAt, endsAt, mediaIds })
    → Сервер создаёт SurfSession + публикует всё одним запросом
    → invalidate: sessions.list
```

#### Где живёт состояние

| Данные | Хранилище |
|--------|-----------|
| Очередь файлов, статусы, прогресс | `useUploadStore` (Zustand, in-memory) |
| Подтверждённые черновики с сервера | TanStack Query: `sessions.draftMedia(sessionId)` |
| Слияние очереди + черновиков | `useUploadQueue` (computed, без хранилища) |
| Текущий спот / session счётчики | `useUploadStore` |
| Режим карты (spot-select) | `useMapStore` |

#### Зависимые фичи

- **Cart** — независима от Upload, работает с опубликованными медиа
- **PublicGallery** — читает опубликованные медиа через `spots.details`; Upload инвалидирует этот ключ через `usePublishMedia` (entities/Media)
- **SessionFeed** (SidePanel) — инвалидируется через `sessions.list` / `sessions.mine` после публикации

---

### Cart

#### Поток данных

```
[1] Добавление в корзину
    PublicGallery → CartButton → useCartItem.add(cartItem)
    → cartStore.add({ id, spotName, priceCents, thumbnailUrl, ... })
    → localStorage['wave-atlas-cart'] обновляется автоматически (persist)

[2] Checkout
    _drawer.cart.tsx → CartPage → useCartCheckout.handleCheckout()
    → cartStore.items → itemIds
    → trpc.checkout.create.mutate({ itemIds })
    → Сервер: валидирует позиции, считает сумму, создаёт CryptoCloud ордер
    → Returns { checkoutUrl }
    → cartStore.clear()
    → window.location.href = checkoutUrl  (hard nav на платёжный шлюз)

[3] Покупки / скачивание
    _drawer.me.purchases.tsx
    → useQuery(trpc.checkout.myPurchases)
    → Per item: trpcClient.checkout.getSignedMediaAccess.query({ mediaItemId })
    → Returns signed URL (временный)
    → window.open(downloadUrl, '_blank')

[4] Сессионная синхронизация
    useCartSessionSync (mounted in __root.tsx)
    → Следит за isAuthenticated
    → clear() при переходе authenticated → unauthenticated
```

#### Где живёт состояние

| Данные | Хранилище |
|--------|-----------|
| Элементы корзины | `cartStore` (Zustand + localStorage) |
| Список покупок | TanStack Query: `checkout.myPurchases` |

---

## 8. Список подозрительных мест

### Критические

**[mapStore.ts:66](src/widgets/GlobeMap/model/mapStore.ts#L66)**
```ts
console.trace('[mapStore] clearSelection');
```
`console.trace` в production-коде. Выводит полный stack trace при каждом закрытии попапа спота. Явный дебаг-артефакт, забытый в коде.

---

**[UploadGallery.tsx:283](src/features/Upload/ui/UploadGallery/UploadGallery.tsx#L283)**
```tsx
}, [items.length, onProceed]); // eslint-disable-line react-hooks/exhaustive-deps
```
`handleModalChange` вызывается внутри эффекта, но не в deps. Без объяснения почему. Если `handleModalChange` изменится между рендерами, эффект зашлёт стейл-вызов.

---

### Средние

**[package.json:64](package.json#L64) — мёртвые зависимости**
```json
"swr": "^2.4.0",
"@trpc/react-query": "^11.15.0"
```
Оба пакета установлены, но **ни один файл в `src/` их не импортирует**. Увеличивают bundle-анализ и могут породить confusion при онбординге ("а мы используем SWR или TQ?").

---

**[useDraftMedia.ts:45+53](src/features/Upload/model/useDraftMedia.ts#L45) — двойная запись в кэш**
```ts
queryClient.setQueryData(queryKey, ...);   // 45: оптимистичная запись
void queryClient.invalidateQueries(...);   // 53: следом рефетч
```
`append` делает оптимистичный `setQueryData`, а затем сразу `invalidate`. Это означает: (1) мгновенный UI-апдейт, (2) фоновый рефетч который перезапишет данные с сервера. При медленной сети возможно мигание если сервер вернёт другой порядок. Не баг, но стоит задокументировать намерение.

---

**[SpotPreviewCard.tsx:18–19](src/features/SpotPreview/SpotPreviewCard.tsx#L18)**
```ts
navigate({ to: `/${spot.id}` as any })
navigate({ to: `/${spot.id}/upload` as any })
```
Динамические пути кастятся через `as any`. Вероятно, TanStack Router не генерирует типы для динамических сегментов корректно, или `routeTree.gen.ts` не обновлён. Скрывает потенциальные опечатки в путях.

---

**[PublicCard.tsx:132](src/features/PublicGallery/ui/cards/PublicCard.tsx#L132)**
```tsx
variant={resolved.variant as any}
```
`resolved.variant` не имеет правильного типа — вынужденный `as any`. Тип Mantine-компонента `variant` не выведен из данных. Локально безопасно, но маскирует несоответствие типов.

---

**[GlobeMapComponent.tsx:170](src/widgets/GlobeMap/GlobeMapComponent.tsx#L170)**
```tsx
projection={{ name: 'globe' as any }}
```
`react-map-gl` не экспортирует тип `ProjectionSpecification` — стандартный workaround для этой библиотеки. Приемлемо.

---

**[mapbox.ts:18](src/shared/api/mapbox.ts#L18)**
```ts
// TODO: route through a centralised HTTP client so non-2xx responses are
// properly handled/logged
```
Прямые fetch-запросы в Mapbox без централизованной обработки ошибок. Non-2xx тихо игнорируются. Геокодирование при ошибке вернёт пустую строку без уведомления пользователя.

---

**[BulkEditToolbar.tsx:72](src/features/Upload/ui/toolbars/BulkEditToolbar.tsx#L72)**
```ts
(BulkEditToolbar as any).displayName = 'BulkEditToolbar';
```
React devtools pattern для `forwardRef` / `memo` компонентов. Технически корректно, но можно задать `displayName` до `as any` через именованный компонент.

---

### Информационные (не баги)

**`useUploadStore.getState()` внутри эффектов и колбэков**
Встречается в [useUploadManager.ts](src/features/Upload/model/useUploadManager.ts) (lines 46, 76, 98, 126 и др.) и [uploadStore.ts:98](src/features/Upload/model/uploadStore.ts#L98) (`clearQueue`). Это намеренный паттерн — прямой доступ к стейту без подписки там, где не нужен реактивный рендер. Корректно.

**`window.location.href` в [useCartCheckout.ts:27](src/features/Cart/model/useCartCheckout.ts#L27)**
Хард-навигация на внешний платёжный шлюз. Cart очищается до навигации. Если шлюз вернёт ошибку — пользователь вернётся с пустой корзиной. Приемлемо для checkout-флоу.

---

## Приоритеты

| # | Что | Где | Усилие |
|---|-----|-----|--------|
| 1 | Удалить `console.trace` | mapStore.ts:66 | Минуты |
| 2 | Удалить `swr` и `@trpc/react-query` из deps | package.json | Минуты |
| 3 | Объяснить или исправить `eslint-disable` | UploadGallery.tsx:283 | Часы |
| 4 | Типизировать роутерные пути | SpotPreviewCard.tsx:18–19 | Часы |
| 5 | Централизовать Mapbox fetch | shared/api/mapbox.ts | День |
