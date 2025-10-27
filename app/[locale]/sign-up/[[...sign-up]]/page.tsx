// app/[locale]/sign-up/[[...sign-up]]/page.tsx

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
        <SignUp />
    </div>
  );
}