import { memo } from 'react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import { formatPrice } from 'shared/lib/currency';
import { formatShortDate } from 'shared/lib/dateUtils';
import materials from 'shared/ui/design-system/materials.module.css';
import classes from './PayoutRequestCard.module.css';

export interface PayoutRequestCardItem {
  id: string;
  amount: number;
  status: string;
  requestedAt: Date;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'gray',
  PROCESSING: 'blue',
  COMPLETED: 'green',
  REJECTED: 'red',
};

function formatPayoutStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PayoutRequestCard({
  request,
}: {
  request: PayoutRequestCardItem
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      className={`${materials.panel} ${classes.card}`}
    >
      <Stack gap={4}>
        <Badge
          size="sm"
          variant="light"
          color={STATUS_COLOR[request.status] ?? 'gray'}
        >
          {formatPayoutStatus(request.status)}
        </Badge>

        <Text size="xs" c="dimmed">
          {formatShortDate(request.requestedAt)}
        </Text>
      </Stack>
      <Text size="sm" fw={600}>{formatPrice(request.amount)}</Text>
    </Group>
  );
}

export default memo(PayoutRequestCard);
