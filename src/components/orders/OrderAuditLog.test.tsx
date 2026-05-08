import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { OrderAuditLog } from "./OrderAuditLog";

// AppContext: control currentUser per test.
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AppContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

describe("OrderAuditLog self-gating", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders nothing when currentUser is null", () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    const { container } = render(<OrderAuditLog orderId="o1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for non-MANAGER roles", () => {
    for (const role of ["WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER", "DIVISION"]) {
      mockUseAuth.mockReturnValue({ currentUser: { id: "u1", role } });
      const { container } = render(<OrderAuditLog orderId="o1" />);
      expect(container.firstChild).toBeNull();
    }
  });

  it("renders the toggle button for MANAGER", () => {
    mockUseAuth.mockReturnValue({ currentUser: { id: "u1", role: "MANAGER" } });
    const { getByText } = render(<OrderAuditLog orderId="o1" />);
    expect(getByText("היסטוריית שינויים")).toBeInTheDocument();
  });
});
