import * as React from "react";

export function Button(props: React.ComponentProps<"button">) {
  const casted = props as any;
  return <button {...casted} />;
}
