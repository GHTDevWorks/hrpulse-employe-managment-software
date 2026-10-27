export const STATUS = {
  present: { label: 'Present', short: 'P', fg: 'text-accent', bg: 'bg-accent-soft', dot: 'bg-accent' },
  late: { label: 'Late', short: 'L', fg: 'text-late', bg: 'bg-late-soft', dot: 'bg-late' },
  half: { label: 'Short day', short: '½', fg: 'text-half', bg: 'bg-half-soft', dot: 'bg-half' },
  leave: { label: 'On leave', short: 'Lv', fg: 'text-leave', bg: 'bg-leave-soft', dot: 'bg-leave' },
  holiday: { label: 'Holiday', short: 'H', fg: 'text-off', bg: 'bg-off-soft', dot: 'bg-off' },
  weekend: { label: 'Weekend', short: 'W', fg: 'text-faint', bg: 'bg-sunken', dot: 'bg-line-strong' },
  absent: { label: 'Absent', short: 'A', fg: 'text-absent', bg: 'bg-absent-soft', dot: 'bg-absent' },
  pending: { label: 'Not in yet', short: '·', fg: 'text-muted', bg: 'bg-sunken', dot: 'bg-faint' },
  none: { label: '', short: '', fg: 'text-faint', bg: 'bg-transparent', dot: 'bg-transparent' },
};

export const LEAVE_TYPES = {
  annual: 'Annual',
  sick: 'Sick',
  casual: 'Casual',
  unpaid: 'Unpaid',
};

export const LEAVE_STATUS = {
  pending: { label: 'Waiting for review', fg: 'text-late', bg: 'bg-late-soft' },
  approved: { label: 'Approved', fg: 'text-accent', bg: 'bg-accent-soft' },
  rejected: { label: 'Declined', fg: 'text-absent', bg: 'bg-absent-soft' },
  cancelled: { label: 'Cancelled', fg: 'text-faint', bg: 'bg-sunken' },
};

export const ROLES = { employee: 'Employee', developer: 'Developer', manager: 'Manager' };
