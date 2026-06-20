import { useState } from 'react';
import { Popover } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import type { SessionFeedFilter } from 'entities/SurfSession';

const pillStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 20,
  color: 'rgba(255,255,255,0.82)',
  fontSize: 11,
  fontWeight: 500,
  padding: '5px 13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  flexShrink: 0,
};

const pillActiveStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  color: '#fff',
};

export function FilterPills({ active, onChange }: { active: SessionFeedFilter; onChange: (f: SessionFeedFilter) => void }) {
  const [open, setOpen] = useState(false);
  const isCustom = active !== null && typeof active === 'object';
  const customLabel = isCustom
    ? (active as { date: Date }).date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  function renderPill(label: string, key: Exclude<SessionFeedFilter, null | { date: Date }>) {
    const isActive = active === key;
    return (
      <button style={{ ...pillStyle, ...(isActive ? pillActiveStyle : {}) }} onClick={() => onChange(isActive ? null : key)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {renderPill('Today', 'today')}
      {renderPill('Yesterday', 'yesterday')}
      {renderPill('Last 7 Days', 'last7')}
      <Popover opened={open} onChange={setOpen} position="bottom-start" shadow="md">
        <Popover.Target>
          <button
            style={{ ...pillStyle, ...(isCustom ? pillActiveStyle : {}) }}
            onClick={() => isCustom ? onChange(null) : setOpen((isOpen) => !isOpen)}
          >
            {customLabel ?? 'Date'}
            <IconCalendar size={12} />
          </button>
        </Popover.Target>
        <Popover.Dropdown p="xs">
          <DatePicker
            maxDate={new Date()}
            value={isCustom ? (active as { date: Date }).date : null}
            onChange={(d) => {
              setOpen(false);
              if (!d) { onChange(null); return; }
              onChange({ date: typeof d === 'string' ? new Date(d) : d });
            }}
          />
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
