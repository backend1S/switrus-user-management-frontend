// jsdom has no layout, so the widths are set by hand.
import { fireEvent, render, screen } from '@testing-library/react'
import { ScrollTable } from '../components/ui/ScrollTable'

function sized(el: HTMLElement, client: number, scroll: number) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: client })
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scroll })
}

describe('ScrollTable', () => {
  it('marks hidden columns on either side and resets to the first column', () => {
    const { container, rerender } = render(
      <ScrollTable label="Employees table" resetKey="a"><table /></ScrollTable>,
    )
    const outer = container.querySelector('.table-scroll') as HTMLElement
    const wrap = screen.getByRole('region', { name: 'Employees table' })
    expect(wrap).toHaveAttribute('tabindex', '0')

    sized(wrap, 300, 1000)
    fireEvent.scroll(wrap)
    expect(outer).toHaveAttribute('data-more-right')
    expect(outer).not.toHaveAttribute('data-more-left')
    expect(screen.getByText(/More columns to the right/)).toBeInTheDocument()

    wrap.scrollLeft = 700
    fireEvent.scroll(wrap)
    expect(outer).toHaveAttribute('data-more-left')
    expect(outer).not.toHaveAttribute('data-more-right')

    // New filters: back to the leftmost column.
    rerender(<ScrollTable label="Employees table" resetKey="b"><table /></ScrollTable>)
    expect(wrap.scrollLeft).toBe(0)
    expect(outer).toHaveAttribute('data-more-right')
    expect(outer).not.toHaveAttribute('data-more-left')
  })

  it('shows no indicator when everything fits', () => {
    const { container } = render(<ScrollTable label="t"><table /></ScrollTable>)
    const wrap = screen.getByRole('region', { name: 't' })
    sized(wrap, 1000, 1000)
    fireEvent.scroll(wrap)
    const outer = container.querySelector('.table-scroll')!
    expect(outer).not.toHaveAttribute('data-more-right')
    expect(outer).not.toHaveAttribute('data-more-left')
  })
})
