import type { IconName } from '@/components/icon-paths';

export const CATEGORIES = [
  { id: 'food', label: 'Food', icon: 'forkKnife' },
  { id: 'drinks', label: 'Drinks', icon: 'coffee' },
  { id: 'transport', label: 'Transport', icon: 'train' },
  { id: 'travel', label: 'Travel', icon: 'airplaneTilt' },
  { id: 'car', label: 'Car', icon: 'car' },
  { id: 'stay', label: 'Stay', icon: 'bed' },
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'bills', label: 'Bills', icon: 'lightning' },
  { id: 'shopping', label: 'Shopping', icon: 'shoppingBag' },
  { id: 'fun', label: 'Fun', icon: 'ticket' },
  { id: 'gifts', label: 'Gifts', icon: 'gift' },
  { id: 'other', label: 'Other', icon: 'dotsThree' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export function categoryOf(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
