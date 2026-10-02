import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { shopApi, type StudentShopItem, type StudentShopOwned, type StudentShopView } from '../../lib/shopApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { isYoungLevel } from '../../components/energy/energyHelpers';
import { RestingBanner } from '../../components/energy/RestingBanner';
import { errorMessage } from '../../components/home/homeHelpers';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { cardText, cardTitle, homeCard } from '../../components/student/home/studentHomeHelpers';
import { GoldCard } from '../../components/student/shop/GoldCard';
import { MyPrizesCard, WaitingCard } from '../../components/student/shop/MyPrizes';
import { PrizeCard } from '../../components/student/shop/PrizeCard';
import { PurchaseDoneModal, PurchaseModal, UsePrizeModal, type PurchaseDone } from '../../components/student/shop/ShopModals';
import { YoungShop } from '../../components/student/shop/YoungShop';
import { myAvatarKey } from '../../components/avatar/avatarHelpers';
import { groupPrizes, groupTitle, myShopKey, nextShopGoal, prizeState, spendableGold, type PrizeContext } from '../../components/student/shop/shopStudentHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
type ShopClassroom = MyClass['classroom'] & { gradeLevel?: string | null };

const Skeleton = () => (
  <div role="status" aria-label="Cargando la tienda" className="space-y-5">
    <div className="h-28 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => <div key={index} className="h-56 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />)}
    </div>
  </div>
);

/**
 * «Tienda»: metas de ahorro en una sola página. Tu oro y tu meta, lo que espera a tu profe, lo que ya
 * te alcanza, para qué ahorrar y tus premios. Las reglas (aprobación, límite, pausa, tienda cerrada)
 * vienen resueltas del servidor; aquí solo se muestran.
 */
const ShopContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const classroom = profile.classroom as ShopClassroom;
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState<StudentShopItem | null>(null);
  const [done, setDone] = useState<PurchaseDone | null>(null);
  const [using, setUsing] = useState<StudentShopOwned | null>(null);
  const mineTitleRef = useRef<HTMLHeadingElement>(null);

  const query = useQuery({ queryKey: myShopKey(profile.id), queryFn: () => shopApi.getStudentView(profile.id) });
  const view = query.data;

  // El oro de la barra y del menú sale de my-classes; «Mi progreso» registra el gasto.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: myShopKey(profile.id) });
    void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    void queryClient.invalidateQueries({ queryKey: ['my-progress', profile.id] });
  };

  const goalMutation = useMutation({
    mutationFn: (itemId: string | null) => shopApi.setGoal(profile.id, itemId),
    onSuccess: ({ goalItemId }) => {
      // Hay una sola meta: elegir un premio reemplaza a la prenda que fuera su meta.
      queryClient.setQueryData<StudentShopView>(myShopKey(profile.id), (old) => (old ? { ...old, goalItemId, goalKind: goalItemId ? 'ITEM' : null, avatarGoal: null } : old));
      // «Tu próxima meta» del inicio lee la meta de my-classes; «Mi personaje», la suya.
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      void queryClient.invalidateQueries({ queryKey: myAvatarKey(profile.id) });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar tu meta')),
  });

  const showMine = () => {
    setDone(null);
    document.getElementById('mis-premios')?.scrollIntoView({ block: 'start' });
    mineTitleRef.current?.focus({ preventScroll: true });
  };

  const header = (
    <StudentPageHeader title="Tienda" subtitle={`${classroom.name} · cambia tu oro por premios`} emoji="🛍️" storyAccent={storyAccent} />
  );
  if (query.isLoading) return <div className="space-y-5">{header}<Skeleton /></div>;
  if (query.isError || !view) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorCard text="No pudimos cargar la tienda." onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const { shop } = view;
  const young = isYoungLevel(shop.gradeLevel ?? classroom.gradeLevel);
  const spendable = spendableGold(view);
  const groups = groupPrizes(view.items, spendable);
  const goal = nextShopGoal(view, spendable);
  const ctx: PrizeContext = {
    enabled: shop.enabled,
    paused: shop.paused,
    spendable,
    limitReached: !!shop.dailyLimit && shop.boughtToday >= shop.dailyLimit,
  };
  const canGift = !young && shop.giftsToday < shop.giftsPerDay;
  const toggleGoal = (item: StudentShopItem) => goalMutation.mutate(view.goalItemId === item.id ? null : item.id);
  const hasItems = view.items.length > 0;

  const card = (item: StudentShopItem) => {
    const owned = view.mine.find((prize) => prize.itemId === item.id);
    return (
      <PrizeCard
        key={item.id}
        item={item}
        state={prizeState(item, ctx)}
        spendable={spendable}
        isGoal={view.goalItemId === item.id}
        canChooseGoal={shop.enabled}
        goalBusy={goalMutation.isPending}
        waiting={view.waiting.filter((entry) => entry.kind === 'purchase' && entry.itemId === item.id).length}
        owned={owned ? { available: owned.available, forever: !owned.consumable } : null}
        onBuy={() => setBuying(item)}
        onToggleGoal={() => toggleGoal(item)}
      />
    );
  };
  const group = (key: string, title: string, items: StudentShopItem[]) => items.length > 0 && (
    <section aria-labelledby={`group-${key}`}>
      <h2 id={`group-${key}`} className={groupTitle}>{title} · {items.length}</h2>
      <ul className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(card)}</ul>
    </section>
  );

  const emptyState = !shop.enabled ? (
    <HomeEmptyState
      emojis={['🔒', '🛍️', '🪙']}
      title="La tienda está cerrada"
      text="Tu profe la abrirá cuando quiera. Tu oro se guarda."
      primary={view.mine.length > 0 ? { label: 'Ver mis premios', onClick: showMine } : { to: '/my-progress', label: 'Ver mi progreso' }}
      secondary={{ to: '/my-class', label: 'Volver al inicio' }}
    />
  ) : (
    <HomeEmptyState
      emojis={['🛍️', '🎁', '✨']}
      title="Tu profe aún no pone premios"
      text="Cuando los ponga, aquí podrás cambiar tu oro por premios. Tu oro se guarda."
      primary={{ to: '/my-progress', label: 'Ver mi progreso' }}
      secondary={{ to: '/my-class', label: 'Volver al inicio' }}
    />
  );

  return (
    <div className="space-y-5">
      {header}
      {profile.hp <= 0 && <RestingBanner profileId={profile.id} />}

      {!shop.enabled && hasItems && (
        <section aria-labelledby="closed-title" className={`${homeCard} flex gap-3`}>
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" aria-hidden="true">
            <Lock size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="closed-title" className={cardTitle}>La tienda está cerrada</h2>
            <p className={cardText}>
              Tu profe la abrirá cuando quiera. Tu oro se guarda.
              {view.mine.some((prize) => prize.consumable && prize.available > 0) && ' Puedes pedir usar tus premios.'}
            </p>
          </div>
        </section>
      )}

      {young ? (
        hasItems ? (
          <YoungShop view={view} spendable={spendable} goal={goal} goalBusy={goalMutation.isPending} onToggleGoal={toggleGoal} />
        ) : emptyState
      ) : (
        <>
          {hasItems && (
            <GoldCard
              view={view}
              spendable={spendable}
              goal={goal}
              affordable={groups.affordable.length}
              inStock={groups.affordable.length + groups.saving.length}
              canBuyGoal={goal?.kind === 'chosen' && prizeState(goal.item, ctx) === 'buy'}
              goalBusy={goalMutation.isPending}
              onBuyGoal={() => goal?.kind === 'chosen' && setBuying(goal.item)}
              onClearGoal={() => goalMutation.mutate(null)}
              onShowMine={showMine}
            />
          )}
          {view.waiting.length > 0 && <WaitingCard waiting={view.waiting} paused={shop.paused} />}
          {!hasItems
            ? emptyState
            : shop.enabled ? (
              <>
                {group('affordable', 'Ya te alcanza', groups.affordable)}
                {group('saving', 'Ahorra para…', groups.saving)}
                {group('soldout', 'Agotados por ahora', groups.soldOut)}
              </>
            ) : group('showcase', 'En la tienda', [...view.items].sort((a, b) => a.price - b.price))}
        </>
      )}

      {young && view.waiting.length > 0 && <WaitingCard waiting={view.waiting} paused={shop.paused} />}
      {view.mine.length > 0 && (
        <MyPrizesCard ref={mineTitleRef} mine={view.mine} paused={shop.paused} young={young} onUse={setUsing} />
      )}

      <AnimatePresence>
        {buying && (
          <PurchaseModal
            key="buy"
            profileId={profile.id}
            classroomId={profile.classroomId}
            item={buying}
            view={view}
            spendable={spendable}
            canGift={canGift}
            onClose={() => setBuying(null)}
            onDone={(result) => {
              setBuying(null);
              setDone(result);
              refresh();
            }}
          />
        )}
        {done && <PurchaseDoneModal key="done" done={done} onClose={() => setDone(null)} onShowMine={showMine} />}
        {using && (
          <UsePrizeModal
            key="use"
            profileId={profile.id}
            prize={using}
            onClose={() => setUsing(null)}
            onDone={() => {
              setUsing(null);
              toast.success('Listo: tu profe verá tu pedido.');
              refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export const StudentItemsShopPage = () => {
  const selectedClassIndex = useStudentStore((s) => s.selectedClassIndex);
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { data: myClasses, isLoading } = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses });
  const profile = myClasses?.[selectedClassIndex];

  if (isLoading) return <Skeleton />;
  if (!profile) return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  return <ShopContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
