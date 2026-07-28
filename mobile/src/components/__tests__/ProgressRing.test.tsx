import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { computeProgressRingGeometry, ProgressRing } from "../ProgressRing";

describe("computeProgressRingGeometry", () => {
  const size = 82;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  test("pct=0 offsets the arc by the full circumference (nothing drawn)", () => {
    const geometry = computeProgressRingGeometry(0, size, strokeWidth);

    expect(geometry.radius).toBeCloseTo(radius);
    expect(geometry.circumference).toBeCloseTo(circumference);
    expect(geometry.dashOffset).toBeCloseTo(circumference);
  });

  test("pct=100 offsets the arc by 0 (fully drawn)", () => {
    const geometry = computeProgressRingGeometry(100, size, strokeWidth);

    expect(geometry.dashOffset).toBeCloseTo(0);
  });

  test("pct=43 offsets the arc proportionally", () => {
    const geometry = computeProgressRingGeometry(43, size, strokeWidth);

    expect(geometry.dashOffset).toBeCloseTo(circumference * 0.57);
  });

  test("clamps out-of-range pct into [0, 100]", () => {
    expect(computeProgressRingGeometry(-10, size, strokeWidth).dashOffset).toBeCloseTo(
      circumference,
    );
    expect(computeProgressRingGeometry(150, size, strokeWidth).dashOffset).toBeCloseTo(0);
  });
});

test("ProgressRing renders its centered children without crashing", () => {
  const { getByText } = render(
    <ThemeProvider>
      <ProgressRing pct={43} trackColor="#123B2E" progressColor="#FFD65A">
        <Text>43%</Text>
      </ProgressRing>
    </ThemeProvider>,
  );

  expect(getByText("43%")).toBeTruthy();
});
