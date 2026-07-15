import { Badge, Button, Group, Progress, Stack, Text } from '@mantine/core';
import { IconCash } from '@tabler/icons-react';
import { formatPrice } from 'shared/lib/currency';
import materials from 'shared/ui/design-system/materials.module.css';
import PayoutRequestCard, { type PayoutRequestCardItem } from './PayoutRequestCard';
import classes from './EarningsPanel.module.css';

export interface EarningsSummary {
  availableBalanceCents: number;
  pendingPayoutCents: number;
  payoutThresholdCents: number;
  payoutRequests: PayoutRequestCardItem[];
}

export interface EarningsPanelProps {
  summary: EarningsSummary;
  isRequestingPayout: boolean;
  onRequestPayout: () => void;
}

export function EarningsPanel({
  summary,
  isRequestingPayout,
  onRequestPayout,
}: EarningsPanelProps) {
  const payoutProgress = Math.min(
    100,
    (summary.availableBalanceCents / summary.payoutThresholdCents) * 100,
  );
  const canRequestPayout = summary.availableBalanceCents >= summary.payoutThresholdCents;

  return (
    <Stack gap="lg">
      <div className={classes.grid}>
        <div className={classes.history}>
          <Text size="sm" c="dimmed">
            Your earnings are calculated based on the sales of your content. You can request a payout once your available balance reaches the minimum threshold.
          </Text>

          <div className={classes.historySection}>
            <Text size="sm" fw={600}>Payout history</Text>

            {summary.payoutRequests.length === 0 ? (
              <Text size="sm" c="dimmed">
                Payout requests will appear here.
              </Text>
            ) : (
              <div className={classes.historyList}>
                {summary.payoutRequests.map((request) => (
                  <PayoutRequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`${materials.status} ${classes.statusCard}`}>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Text size="xs" c="dimmed" tt="uppercase">Available balance</Text>
              <Badge variant="light" color={canRequestPayout ? 'green' : 'gray'}>
                {canRequestPayout ? 'Ready' : 'Below threshold'}
              </Badge>
            </Group>

            <Text fw={700} fz="var(--wa-font-size-display)">
              {formatPrice(summary.availableBalanceCents)}
            </Text>

            <Progress
              value={payoutProgress}
              size="sm"
              radius="xl"
              color="green"
            />

            <Text size="xs" c="dimmed">
              Payouts unlock at {formatPrice(summary.payoutThresholdCents)}.
            </Text>

            <Button
              radius={"md"}
              disabled={!canRequestPayout || isRequestingPayout}
              leftSection={<IconCash size={16} />}
              loading={isRequestingPayout}
              onClick={onRequestPayout}
            >
              Request payout
            </Button>

            <Group justify="space-between">
              <Text size="xs" c="dimmed">Pending payout</Text>
              <Text size="sm" fw={600}>{formatPrice(summary.pendingPayoutCents)}</Text>
            </Group>
          </Stack>
        </div>
      </div>
    </Stack>
  );
}
