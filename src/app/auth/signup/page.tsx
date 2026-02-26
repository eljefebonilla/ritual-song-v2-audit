import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif text-stone-900">
            Create Account
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Join the St. Monica Music Ministry
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-parish-burgundy font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-stone-400 hover:text-stone-600"
          >
            &larr; Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
