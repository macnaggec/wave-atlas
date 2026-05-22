import { FC, memo, ReactNode } from 'react';
import { Modal, Stack } from '@mantine/core';

export interface BaseLightboxItem {
  id: string;
  url: string;
  type?: 'image' | 'video';
}

export interface BaseLightboxProps {
  /** null = modal closed */
  item: BaseLightboxItem | null;
  onClose: () => void;
  /** Render price, actions, or any context-specific footer content. */
  renderFooter?: () => ReactNode;
}

const mediaStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: '55vh',
  objectFit: 'contain',
  display: 'block',
};

/**
 * BaseLightbox — minimal modal shell for single-item preview.
 *
 * No carousel, no index state. Pass item=null to close.
 * For multi-item navigation use CarouselLightbox.
 */
const BaseLightbox: FC<BaseLightboxProps> = memo(({ item, onClose, renderFooter }) => {
  return (
    <Modal opened={item !== null} onClose={onClose} size="xl" centered padding="md" withCloseButton zIndex={300}>
      {item && (
        <Stack gap="md">
          {item.type === 'video'
            ? <video src={item.url} style={mediaStyle} controls preload="metadata" />
            : <img src={item.url} alt="Media preview" style={mediaStyle} />
          }
          {renderFooter?.()}
        </Stack>
      )}
    </Modal>
  );
});

BaseLightbox.displayName = 'BaseLightbox';
export default BaseLightbox;
