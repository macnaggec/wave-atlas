import { render as testingLibraryRender } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from '../../../../app/theme'

export function render(ui: React.ReactNode) {
  return testingLibraryRender(
    <MantineProvider theme={theme}>
      {ui}
    </MantineProvider>,
  )
}
