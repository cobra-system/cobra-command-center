import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DocumentsSection from "./DocumentsSection";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// AppContext: control currentUser per test.
const mockUseAuth = vi.fn();
const mockFormatPrice = vi.fn((amount: number) => `$${amount}`);
vi.mock("@/contexts/AppContext", () => ({
  useAuth: () => mockUseAuth(),
  useCurrency: () => ({ formatPrice: mockFormatPrice, displayCurrency: "USD", setDisplayCurrency: vi.fn() }),
}));

// Supabase: return empty arrays so the MANAGER render path doesn't throw.
vi.mock("@/lib/supabase", () => {
  type Builder = {
    select: () => Builder;
    eq: () => Builder;
    order: () => Promise<{ data: unknown[] }>;
  };
  const builder: Builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: [] }),
  };
  return {
    supabase: { from: vi.fn(() => builder) },
  };
});

const renderWith = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <DocumentsSection orderId="order-1" {...props} />
    </MemoryRouter>,
  );

describe("DocumentsSection self-gating", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders nothing when currentUser is null", () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    const { container } = renderWith();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for WAREHOUSE_MANAGER", () => {
    mockUseAuth.mockReturnValue({ currentUser: { id: "u1", role: "WAREHOUSE_MANAGER" } });
    const { container } = renderWith();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for a division manager (DIVISION + division)", () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: "u1", role: "DIVISION", division: "פריזבי קרסו" },
    });
    const { container } = renderWith();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for LOGISTICS / DRIVER roles", () => {
    for (const role of ["LOGISTICS", "DRIVER"]) {
      mockUseAuth.mockReturnValue({ currentUser: { id: "u1", role } });
      const { container } = renderWith();
      expect(container.firstChild).toBeNull();
    }
  });

  // Note: positive MANAGER case isn't tested here because the component
  // pulls in SimpleFileUploadDialog which depends on useData/useProducts/
  // useTanStackQuery. The regression value is asserting non-MANAGER never
  // renders; that's the gate we care about. Positive path is exercised
  // in manual usage and via E2E.
});
