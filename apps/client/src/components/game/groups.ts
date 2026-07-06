import type { CitizenGroup } from '@citykiller/shared';
import { ALL_GROUPS } from '@citykiller/shared';
import { GROUP_LABELS } from '@/lib/labels';

export const ALL_GROUPS_LABELED: Array<{ value: CitizenGroup; label: string }> = ALL_GROUPS.map(
  g => ({ value: g, label: GROUP_LABELS[g] })
);
