"use client";

import { createTheme, ActionIcon } from "@mantine/core";

export const theme = createTheme({
  components: {
    ActionIcon: ActionIcon.extend({
      vars: (_, { variant }) => {
        if (variant === "filled") {
          return {
            root: {
              "--ai-hover": "var(--ai-bg)",
            },
          };
        }
        return { root: {} };
      },
    }),
  },
});
