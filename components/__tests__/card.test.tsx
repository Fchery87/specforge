import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";

describe("Card component", () => {
  it("renders default variant with a hairline border and no lift", () => {
    const { container } = render(
      <Card>
        <CardContent>Default content</CardContent>
      </Card>
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("border-line");
    expect(card).toHaveClass("hover:border-line-strong");
    expect(card).not.toHaveClass("hover:bg-primary");
    expect(card).not.toHaveClass("hover:shadow-lg");
    expect(card).not.toHaveClass("hover:-translate-y-1");
  });

  it("renders interactive variant with a border and background shift on hover", () => {
    const { container } = render(
      <Card variant="interactive">
        <CardHeader>
          <CardTitle>Interactive Title</CardTitle>
          <CardDescription>Interactive Description</CardDescription>
        </CardHeader>
        <CardContent>Card body</CardContent>
      </Card>
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("border-line");
    expect(card).toHaveClass("hover:border-line-strong");
    expect(card).toHaveClass("hover:bg-raised");
    expect(card).not.toHaveClass("hover:shadow-lg");
    expect(card).not.toHaveClass("hover:-translate-y-1");

    const title = screen.getByText("Interactive Title");
    expect(title).toHaveClass("text-body");
    expect(title).toHaveClass("group-hover:text-primary");

    const description = screen.getByText("Interactive Description");
    expect(description).toHaveClass("group-hover:text-ink");
  });
});
