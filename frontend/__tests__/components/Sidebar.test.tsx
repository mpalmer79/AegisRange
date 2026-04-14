import { render, screen } from '@testing-library/react';

// Mock next/navigation
const mockUsePathname = jest.fn(() => '/');
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock responsive hook
jest.mock('@/lib/responsive', () => ({
  useViewport: () => ({ isDesktop: true }),
}));

// Mock CommandPalette
jest.mock('@/components/CommandPalette', () => ({
  useCommandPalette: () => ({ openPalette: jest.fn() }),
}));

// Mock auth context
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    username: null,
    role: null,
    loading: false,
    demoMode: false,
    expiresAt: null,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

import Sidebar from '@/components/Sidebar';

describe('Sidebar', () => {
  it('renders all nav items', () => {
    render(<Sidebar open={true} onClose={jest.fn()} />);
    const expectedLabels = [
      'Dashboard',
      'Architecture',
      'Scenarios',
      'Training Ops',
      'Career',
      'Events',
      'Alerts',
      'Analytics',
      'Incidents',
      'ATT&CK Matrix',
      'Kill Chain',
      'Campaigns',
      'Reports',
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('highlights the active route for /', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar open={true} onClose={jest.fn()} />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toBeInTheDocument();
    // Active link should have cyan-related styling
    expect(dashboardLink?.className).toMatch(/cyan/);
  });

  it('highlights the active route for /scenarios', () => {
    mockUsePathname.mockReturnValue('/scenarios');
    render(<Sidebar open={true} onClose={jest.fn()} />);
    const scenariosLink = screen.getByText('Scenarios').closest('a');
    expect(scenariosLink).toBeInTheDocument();
    expect(scenariosLink?.className).toMatch(/cyan/);
  });

  it('non-active links do not have active styling', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar open={true} onClose={jest.fn()} />);
    const scenariosLink = screen.getByText('Scenarios').closest('a');
    expect(scenariosLink?.className).not.toMatch(/cyan/);
  });

  it('renders the version number', () => {
    render(<Sidebar open={true} onClose={jest.fn()} />);
    expect(screen.getByText(/v0\.\d+\.\d+/)).toBeInTheDocument();
  });
});
