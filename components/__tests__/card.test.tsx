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
  it("renders default variant with border hover class", () => {
    const { container } = render(
      <Card>
        <CardContent>Default content</CardContent>
      </Card>
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("hover:border-primary/50");
    expect(card).not.toHaveClass("hover:bg-primary");
  });

  it("renders interactive variant with primary border, lift, and shadow classes", () => {
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
    expect(card).toHaveClass("hover:border-primary");
    expect(card).toHaveClass("hover:shadow-lg");
    expect(card).toHaveClass("hover:-translate-y-1");
    expect(card).not.toHaveClass("hover:bg-primary");

    const title = screen.getByText("Interactive Title");
    expect(title).toHaveClass("group-hover:text-primary");

    const description = screen.getByText("Interactive Description");
    expect(description).toHaveClass("group-hover:text-foreground/90");
  });
});
