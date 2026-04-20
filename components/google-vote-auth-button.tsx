"use client";

import { signIn, signOut } from "next-auth/react";

type GoogleVoteAuthButtonProps = {
  callbackUrl: string;
  className: string;
  label: string;
  mode: "signin" | "signout";
};

export function GoogleVoteAuthButton({
  callbackUrl,
  className,
  label,
  mode
}: GoogleVoteAuthButtonProps) {
  return (
    <button
      className={className}
      onClick={() =>
        mode === "signin"
          ? signIn("google", { callbackUrl })
          : signOut({ callbackUrl })
      }
      type="button"
    >
      {label}
    </button>
  );
}
