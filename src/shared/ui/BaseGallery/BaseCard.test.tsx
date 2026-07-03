import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
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
