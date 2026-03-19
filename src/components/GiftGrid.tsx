import type { Gift } from '../types/gift';
import type { Role } from '../types/auth';
import { GiftCard } from './GiftCard';

interface GiftGridProps {
  gifts: Gift[];
  role: Role | null;
  actionLoading: Record<string, boolean>;
  onReserve: (gift: Gift) => void;
  onUnreserve: (gift: Gift) => void;
  onEdit: (gift: Gift) => void;
  onDelete: (gift: Gift) => void;
}

export function GiftGrid({ gifts, role, actionLoading, onReserve, onUnreserve, onEdit, onDelete }: GiftGridProps) {
  return (
    <section className="gift-grid">
      {gifts.map((gift) => (
        <GiftCard
          key={gift.id}
          gift={gift}
          role={role}
          isLoading={Boolean(actionLoading[gift.id])}
          onReserve={onReserve}
          onUnreserve={onUnreserve}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
