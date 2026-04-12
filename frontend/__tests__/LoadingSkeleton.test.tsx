import { render, screen } from '@testing-library/react';
import LoadingSkeleton, { CardSkeleton, MetricsSkeleton } from '@/app/components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders the default number of skeleton lines', () => {
    const { container } = render(<LoadingSkeleton />);
    // Default is 3 lines
    const lines = container.querySelectorAll('.space-y-2');
    expect(lines).toHaveLength(3);
  });

  it('renders a custom number of lines', () => {
    const { container } = render(<LoadingSkeleton lines={5} />);
    const lines = container.querySelectorAll('.space-y-2');
    expect(lines).toHaveLength(5);
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSkeleton className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});

describe('CardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});

describe('MetricsSkeleton', () => {
  it('renders 4 metric cards', () => {
    const { container } = render(<MetricsSkeleton />);
    const cards = container.querySelectorAll('.animate-pulse');
    expect(cards).toHaveLength(4);
  });
});
