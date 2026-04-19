import { render as testingLibraryRender } from '@testing-library/react'
import { MantineProvider, Drawer, mergeThemeOverrides } from '@mantine/core'

// Disable all Mantine transitions in tests.
// jsdom has no CSS engine so transitionend never fires; Drawer would keep its
// content in the DOM forever unless duration is 0.
const testTheme = mergeThemeOverrides({}, {
  components: {
    Drawer: Drawer.extend({
      defaultProps: {
        transitionProps: { duration: 0 },
      },
    }),
  },
})

export function render(ui: React.ReactNode) {
  return testingLibraryRender(
    <MantineProvider theme={testTheme}>
      {ui}
    </MantineProvider>,
  )
}
