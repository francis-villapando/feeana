// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTimePicker } from "../../components/faculty/DateTimePicker";

const BASE = "2026-09-18T10:00:00.000Z";

function isoPlus(baseIso: string, minutes: number): string {
  return new Date(new Date(baseIso).getTime() + minutes * 60_000).toISOString();
}

function Fixture({
  initialValue,
  minDateTime,
  onEmit,
}: {
  initialValue?: string;
  minDateTime?: string;
  onEmit: (iso: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  return (
    <DateTimePicker
      value={value}
      onChange={(v) => {
        onEmit(v);
        setValue(v);
      }}
      minDateTime={minDateTime}
      quickPresets
    />
  );
}

async function openPopover(container: HTMLElement) {
  const trigger = container.querySelector("button");
  await act(async () => {
    trigger?.click();
  });
}

async function clickPreset(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === label,
  );
  expect(button, `preset button "${label}" not rendered`).toBeDefined();
  await act(async () => {
    button?.click();
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // jsdom lacks ResizeObserver, which Radix popover positioning requires.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("DateTimePicker quick presets", () => {
  it("stacks repeated preset clicks on the current value", async () => {
    const emitted: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Fixture initialValue={BASE} onEmit={(v) => emitted.push(v)} />);
    });

    await openPopover(container);
    await clickPreset("+15m");
    await clickPreset("+15m");

    expect(emitted).toEqual([isoPlus(BASE, 15), isoPlus(BASE, 30)]);

    root.unmount();
    container.remove();
  });

  it("seeds the first preset click from minDateTime when no value is set", async () => {
    const emitted: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Fixture minDateTime={BASE} onEmit={(v) => emitted.push(v)} />);
    });

    await openPopover(container);
    await clickPreset("+30m");

    expect(emitted).toEqual([isoPlus(BASE, 30)]);

    root.unmount();
    container.remove();
  });
});
