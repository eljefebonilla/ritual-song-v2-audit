import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif text-stone-900">Sign In</h1>
          <p className="text-stone-500 text-sm mt-1">
            Sign in to your ministry account
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="text-parish-burgundy font-medium hover:underline"
          >
            Create one
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
