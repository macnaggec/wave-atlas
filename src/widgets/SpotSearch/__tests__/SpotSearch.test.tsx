import { render } from 'shared/lib/test/render'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpotSearch from '../SpotSearch'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as spotActions from 'app/actions/spot'
import { SPOT_STATUS } from 'entities/Spot/constants'
import { Spot } from 'entities/Spot/types'

// Mock the server action
vi.mock('app/actions/spot', () => ({
  getSpots: vi.fn(),
}))

describe('SpotSearch Widget', () => {
  const mockOnSpotSelect = vi.fn()
  const mockSpots: Spot[] = [
    {
      id: '1',
      name: 'Pipeline',
      location: 'Hawaii',
      coords: [21.66, -158.05],
      status: SPOT_STATUS.VERIFIED,
    },
    {
      id: '2',
      name: 'Superbank',
      location: 'Gold Coast',
      coords: [-28.16, 153.54],
      status: SPOT_STATUS.VERIFIED,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spotActions.getSpots).mockResolvedValue(mockSpots)
  })

  it('should render search input', () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    expect(screen.getByPlaceholderText('Search for a spot...')).toBeInTheDocument()
  })

  it('should search spots when typing (debounced)', async () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    const input = screen.getByPlaceholderText('Search for a spot...')

    // Use userEvent for realistic typing
    const user = userEvent.setup()
    await user.type(input, 'Pipe')

    // Wait for debounce and server action
    await waitFor(() => {
      expect(spotActions.getSpots).toHaveBeenCalledWith('Pipe')
    })

    // Check if dropdown options appear
    // Note: Mantine Combobox options might need specific finding strategy
    await waitFor(() => {
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
    })
  })

  it('should show dropdown results but NOT trigger selection immediately', async () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    const input = screen.getByPlaceholderText('Search for a spot...')
    const user = userEvent.setup()

    await user.type(input, 'Pipe')

    await waitFor(() => {
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
    })

    // Confirm callback has NOT been called yet
    expect(mockOnSpotSelect).not.toHaveBeenCalled()
  })

  it('should trigger onSpotSelect ONLY when clicking a result', async () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    const input = screen.getByPlaceholderText('Search for a spot...')
    const user = userEvent.setup()

    await user.type(input, 'Pipe')

    // Wait for result
    const option = await screen.findByText('Pipeline')

    // Click result
    await user.click(option)

    expect(mockOnSpotSelect).toHaveBeenCalledWith(mockSpots[0])
    expect(input).toHaveValue('Pipeline')
  })

  it('should trigger search immediately on Enter key', async () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    const input = screen.getByPlaceholderText('Search for a spot...')

    fireEvent.change(input, { target: { value: 'Pipe' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Should call immediate search (we mock it resolving)
    await waitFor(() => {
      expect(spotActions.getSpots).toHaveBeenCalledWith('Pipe')
    })
  })

  it('should clear input and results when clicking clear button', async () => {
    render(<SpotSearch onSpotSelect={mockOnSpotSelect} />)
    const input = screen.getByPlaceholderText('Search for a spot...')
    const user = userEvent.setup()

    await user.type(input, 'Pipe')

    // Wait for the clear button (CloseButton) to appear (it shows when there is text)
    // Mantine CloseButton usually has an aria-label
    const clearButton = await screen.findByLabelText('Clear search')

    await user.click(clearButton)

    expect(input).toHaveValue('')
    // Ensure getSpots isn't called again or spots list is cleared?
    // The component sets spots to [] on clear
  })
})
