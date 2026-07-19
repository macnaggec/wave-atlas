import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import BaseCard from './BaseCard';

function wrap(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('BaseCard', () => {
  it('renders <img> with the imageUrl for image resources', () => {
    const { container } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/photo.jpg" resourceType="image" alt="Test photo" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders <img> with the poster frame URL for video resources', () => {
    const posterUrl = 'https://cdn.example.com/poster.jpg';
    const { container } = wrap(
      <BaseCard imageUrl={posterUrl} resourceType="video" alt="Test video" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(posterUrl);
    expect(container.querySelector('video')).toBeNull();
  });

  it('shows a play indicator for video resources', () => {
    const { container } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/poster.jpg" resourceType="video" />,
    );
    // The videoIndicator div contains the play icon svg
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('does not show a play indicator for image resources', () => {
    const { container } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/photo.jpg" resourceType="image" />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('swaps a broken image for the fallback placeholder on load error', () => {
    const { container, getByLabelText } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/missing.jpg" resourceType="image" alt="Test photo" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(getByLabelText('Test photo — image unavailable')).not.toBeNull();
  });

  it('does not open (invoke onClick) once the image is broken', () => {
    const onClick = vi.fn();
    const { container } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/missing.jpg" resourceType="image" onClick={onClick} />,
    );
    const card = container.querySelector('[data-media-card-aspect="tall"]')!;

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.error(container.querySelector('img')!);
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1); // still 1 — broken card is inert
    expect(card.getAttribute('data-media-unavailable')).toBe('true');
  });

  it('keeps overlays/actions visible on a broken image — BaseCard only reports failure, callers decide what to hide', () => {
    const { container, getByText } = wrap(
      <BaseCard
        imageUrl="https://cdn.example.com/missing.jpg"
        resourceType="image"
        overlays={<span>Price</span>}
        actions={<button type="button">Retry</button>}
      />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(getByText('Price')).not.toBeNull();
    expect(getByText('Retry')).not.toBeNull();
  });

  it('reports load failure via onBrokenChange, without calling it on a successful mount', () => {
    const onBrokenChange = vi.fn();
    const { container } = wrap(
      <BaseCard
        imageUrl="https://cdn.example.com/missing.jpg"
        resourceType="image"
        onBrokenChange={onBrokenChange}
      />,
    );

    expect(onBrokenChange).not.toHaveBeenCalled();

    fireEvent.error(container.querySelector('img')!);

    expect(onBrokenChange).toHaveBeenCalledWith(true);
  });

  it('marks media cards as tall gallery items', () => {
    const { container } = wrap(
      <BaseCard imageUrl="https://cdn.example.com/photo.jpg" resourceType="image" />,
    );

    expect(container.querySelector('[data-media-card-aspect="tall"]')).not.toBeNull();
  });

  it('marks card actions for glass styling', () => {
    const { container } = wrap(
      <BaseCard
        imageUrl="https://cdn.example.com/photo.jpg"
        resourceType="image"
        actions={<button type="button">Save</button>}
      />,
    );

    expect(container.querySelector('[data-gallery-card-actions="glass"]')).not.toBeNull();
  });
});
