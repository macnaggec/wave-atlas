import { MediaItem, MediaResource } from 'entities/Media/types';
import Video from '../Video';
import Image from 'next/image';
import { FC, memo } from 'react';

export interface MediaCardProps {
    mediaItem: MediaItem
}

const MediaCard: FC<MediaCardProps> = memo(({
    mediaItem,
}) => {
    const { resource: {
        resource_type,
        url,
        playback_url = '',
        asset_id,
    } } = mediaItem;

    return (
        <>
            {resource_type === 'image' && (
                <Image
                    src={url}
                    alt={`mediaItem-${asset_id}`}
                    layout="responsive"
                    height={100}
                    width={100}
                    loading="lazy"
                    priority={false}
                    unoptimized
                />
            )}

            {resource_type === 'video' && (
                <Video
                    playbackUrl={playback_url}
                    controls
                />
            )}
        </>
    );
});

MediaCard.displayName = 'MediaCard';

export default MediaCard;
