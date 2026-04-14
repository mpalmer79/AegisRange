import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockLogin = jest.fn();
const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    username: null,
    role: null,
    loading: false,
    demoMode: false,
    expiresAt: null,
    login: mockLogin,
    logout: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Reset search params between tests.
  mockSearchParams.delete('redirect');
});

describe('LoginPage', () => {
  it('renders username and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a sign-in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders platform role badges', () => {
    render(<LoginPage />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('red_team')).toBeInTheDocument();
    expect(screen.getByText('viewer')).toBeInTheDocument();
  });

  it('calls login and redirects to / by default on success', async () => {
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'red_team1' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'red_team1_pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('red_team1', 'red_team1_pass');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to ?redirect= target after login', async () => {
    mockSearchParams.set('redirect', '/scenarios');
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'red_team1' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'red_team1_pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/scenarios');
    });
  });

  it('shows error on invalid credentials (401)', async () => {
    mockLogin.mockRejectedValue(new ApiError(401, 'Unauthorized'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'bad' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'creds' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });
    // Raw API text must not leak.
    expect(screen.queryByText(/API 401/)).not.toBeInTheDocument();
  });

  it('shows rate-limit error on 429', async () => {
    mockLogin.mockRejectedValue(new ApiError(429, 'Too Many Requests'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'y' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
    });
  });

  it('shows network error when backend unreachable', async () => {
    mockLogin.mockRejectedValue(new Error('The operation was aborted'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'y' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/unable to reach the server/i)).toBeInTheDocument();
    });
  });
});
