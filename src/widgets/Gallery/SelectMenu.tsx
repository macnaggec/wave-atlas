import { deleteMedia } from 'app/actions/media';
import { ActionIcon, Menu, rem } from '@mantine/core';
import { IconArrowsLeftRight, IconDots, IconMessageCircle, IconPhoto, IconPhotoShare, IconSearch, IconSettings, IconTrash } from '@tabler/icons-react';
import { FC, ReactNode } from 'react';

export interface SelectMenuProps {
    isDisabled: boolean;
    ids: string[];
    actions: ReactNode;
}

const SelectMenu: FC<SelectMenuProps> = ({
    isDisabled,
    actions,
}) => {
    return (
        <Menu shadow="md" width={200} position={'bottom-end'}>
            <Menu.Target>
                <ActionIcon
                    variant="outline"
                    radius={'xl'}
                    disabled={isDisabled}
                >
                    <IconDots style={{ width: '70%', height: '70%' }} stroke={1.5} />
                </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
                {actions}
            </Menu.Dropdown>
        </Menu>
    );
}

export default SelectMenu;
